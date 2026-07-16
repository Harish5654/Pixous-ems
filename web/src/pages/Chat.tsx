import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import {
  Loader2,
  Send,
  MessageSquare,
  Hash,
  Megaphone,
  Search,
  CheckCheck,
  Mic,
  Lock,
  UserPlus,
  X,
  Users,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { resolvePhotoUrl } from "@/components/ui/avatar";
import dayjs from "dayjs";
import toast from "react-hot-toast";

interface CommunityGroup {
  id: number;
  name: string;
  description: string;
  isAnnouncement?: boolean;
  announcement?: boolean;
  direct?: boolean;
  partnerId?: number;
  partnerPhotoPath?: string;
}

interface Contact {
  id: number;
  employeeCode: string;
  name: string;
  email?: string;
  photoPath?: string;
  roles?: string[];
}

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Small circular avatar with photo fallback to initials. */
function PersonAvatar({ name, photoPath, size = 40, active }: { name?: string; photoPath?: string; size?: number; active?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoPath]);
  const url = failed ? undefined : resolvePhotoUrl(photoPath);
  const dim = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={dim}
        className="rounded-full object-cover border shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      style={dim}
      className={`rounded-full flex items-center justify-center text-xs font-bold border shrink-0 ${
        active ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary/10 text-primary"
      }`}
    >
      {initials(name)}
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [chatSearch, setChatSearch] = useState("");

  // People-picker for starting a private 1:1 chat
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  // Voice message recording state
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: myGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ["my_communities"],
    queryFn: async () => {
      const res = await api.get<CommunityGroup[]>("/communities/me");
      return res.data;
    }
  });

  const { messages, isLoading: chatLoading, sendMessage, sendVoice, deleteMessage } = useChat(activeGroupId);

  const stopTimer = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  async function startRecording() {
    if (!activeGroupId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      cancelledRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (cancelledRef.current || blob.size === 0) return;
        setSendingVoice(true);
        try {
          await sendVoice(blob);
        } catch (err: any) {
          toast.error(err.response?.data?.message || "Could not send voice message");
        } finally {
          setSendingVoice(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch (err) {
      toast.error("Microphone access denied or unavailable.");
    }
  }

  function stopRecording(cancel: boolean) {
    cancelledRef.current = cancel;
    setRecording(false);
    try {
      mediaRecorderRef.current?.stop();
    } catch { /* already stopped */ }
    stopTimer();
  }

  async function onDeleteMessage(messageId: number) {
    try {
      await deleteMessage(messageId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Could not delete message");
    }
  }

  // Contacts for starting a private chat (loaded only while the picker is open)
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["chat_contacts"],
    queryFn: async () => {
      const res = await api.get<Contact[]>("/communities/contacts");
      return res.data;
    },
    enabled: pickerOpen
  });

  const startDirect = useMutation({
    mutationFn: async (userId: number) => {
      const res = await api.post<CommunityGroup>(`/communities/direct/${userId}`);
      return res.data;
    },
    onSuccess: async (group) => {
      await qc.invalidateQueries({ queryKey: ["my_communities"] });
      setActiveGroupId(group.id);
      setPickerOpen(false);
      setContactSearch("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Could not start chat");
    }
  });

  // Auto-scroll messages to bottom
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, chatLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activeGroupId) return;
    const msg = draft;
    setDraft("");
    try {
      await sendMessage(msg);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send message");
    }
  };

  if (groupsLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary w-10 h-10" />
      </div>
    );
  }

  const activeGroup = myGroups?.find((g) => g.id === activeGroupId);
  const isAdminOrHr = user?.roles?.some((r) => r === "SUPER_ADMIN" || r === "IT_HR");

  const isAnnouncement = !!(activeGroup?.announcement ?? activeGroup?.isAnnouncement);
  const isDirect = !!activeGroup?.direct;
  const canPost = !isAnnouncement || isAdminOrHr;

  // Filter my conversations based on search text
  const filteredGroups =
    myGroups?.filter(
      (g) =>
        g.name.toLowerCase().includes(chatSearch.toLowerCase()) ||
        (g.description || "").toLowerCase().includes(chatSearch.toLowerCase())
    ) || [];
  const channels = filteredGroups.filter((g) => !g.direct);
  const directChats = filteredGroups.filter((g) => g.direct);

  const filteredContacts =
    contacts?.filter(
      (c) =>
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        (c.employeeCode || "").toLowerCase().includes(contactSearch.toLowerCase())
    ) || [];

  const renderGroupButton = (group: CommunityGroup) => {
    const active = activeGroupId === group.id;
    const groupIsAnnouncement = !!(group.announcement ?? group.isAnnouncement);
    return (
      <button
        key={group.id}
        onClick={() => setActiveGroupId(group.id)}
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
          active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
        }`}
      >
        {group.direct ? (
          <PersonAvatar name={group.name} photoPath={group.partnerPhotoPath} size={38} active={active} />
        ) : (
          <div
            className={`p-2 rounded-lg ${
              active
                ? "bg-primary-foreground/10"
                : groupIsAnnouncement
                ? "bg-amber-100 text-amber-700"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {groupIsAnnouncement ? <Megaphone className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-sm truncate">{group.name}</div>
            {group.direct ? (
              <Lock className={`w-3 h-3 shrink-0 ${active ? "text-primary-foreground/80" : "text-emerald-600"}`} />
            ) : (
              groupIsAnnouncement && (
                <Badge
                  variant="outline"
                  className={`text-[9px] uppercase px-1.5 py-0 ${
                    active
                      ? "text-primary-foreground border-primary-foreground/30 bg-primary-foreground/5"
                      : "text-amber-700 border-amber-300 bg-amber-50"
                  }`}
                >
                  Official
                </Badge>
              )
            )}
          </div>
          <div className={`text-xs truncate ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
            {group.direct ? (group.description ? `${group.description} · Private chat` : "Private chat") : group.description}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="relative flex h-[calc(100vh-8.5rem)] rounded-2xl border bg-card overflow-hidden shadow-md">
      {/* Sidebar: Conversations */}
      <div className="w-1/3 md:w-1/4 border-r bg-muted/10 flex flex-col relative">
        {/* Sidebar Header */}
        <div className="p-4 border-b bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Chats
            </h2>
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-full"
              onClick={() => {
                setPickerOpen(true);
                setContactSearch("");
              }}
            >
              <UserPlus className="w-4 h-4" />
              New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              className="pl-8 bg-muted/30 focus-visible:ring-1"
            />
          </div>
        </div>

        {/* Sidebar List */}
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {filteredGroups.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">No conversations found.</div>
          )}

          {channels.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Channels &amp; Groups
              </div>
              {channels.map(renderGroupButton)}
            </>
          )}

          {directChats.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" /> Personal Chats
              </div>
              {directChats.map(renderGroupButton)}
            </>
          )}
        </div>

        {/* People Picker Overlay */}
        {pickerOpen && (
          <div className="absolute inset-0 z-20 bg-card flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                New personal chat
              </h3>
              <button
                onClick={() => setPickerOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search people..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="pl-8 bg-muted/30 focus-visible:ring-1"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {contactsLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center flex flex-col items-center gap-2">
                  <Users className="w-6 h-6 opacity-30" />
                  No people found.
                </div>
              ) : (
                filteredContacts.map((c) => (
                  <button
                    key={c.id}
                    disabled={startDirect.isPending}
                    onClick={() => startDirect.mutate(c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-muted transition-all disabled:opacity-60"
                  >
                    <PersonAvatar name={c.name} photoPath={c.photoPath} size={38} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.employeeCode}</div>
                    </div>
                    {startDirect.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="p-3 border-t text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3 h-3 shrink-0 text-emerald-600" />
              Private 1-to-1 conversation — only you two can see it.
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-card relative">
        {activeGroupId && activeGroup ? (
          <>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between bg-muted/10">
              <div className="flex items-center gap-3">
                {isDirect ? (
                  <PersonAvatar name={activeGroup.name} photoPath={activeGroup.partnerPhotoPath} size={42} />
                ) : (
                  <div className={`p-2.5 rounded-xl ${isAnnouncement ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                    {isAnnouncement ? <Megaphone className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm md:text-base leading-tight">{activeGroup.name}</h3>
                  {isDirect ? (
                    <span className="text-xs text-emerald-600 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Private chat
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground block truncate max-w-md">{activeGroup.description}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]/30 dark:bg-muted/5">
              {chatLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;
                  const showName = !isMe && !isDirect && (idx === 0 || messages[idx - 1].senderId !== msg.senderId);

                  const audioUrl = msg.audioPath ? resolvePhotoUrl(msg.audioPath) : undefined;

                  return (
                    <div key={`${msg.messageId}-${idx}`} className={`group flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {showName && (
                        <span className="text-[11px] font-semibold text-muted-foreground mb-0.5 ml-1">{msg.senderName}</span>
                      )}
                      <div className={`flex items-center gap-1.5 ${isMe ? "flex-row" : "flex-row-reverse"}`}>
                        {/* Delete button — only for my own messages */}
                        {isMe && (
                          <button
                            onClick={() => onDeleteMessage(msg.messageId)}
                            title="Delete message"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 shrink-0 p-1"
                            aria-label="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div
                          className={`max-w-[75%] px-3.5 py-2 rounded-2xl shadow-sm relative ${
                            isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card text-foreground border rounded-tl-none"
                          }`}
                        >
                          {audioUrl ? (
                            <div className="pb-3.5">
                              <audio controls src={audioUrl} className="h-9 max-w-[220px]" />
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap leading-snug break-words pr-8">{msg.content}</p>
                          )}
                          <div className="absolute right-2.5 bottom-1 flex items-center gap-1">
                            <span className={`text-[9px] ${isMe ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                              {dayjs(msg.sentAt).format("h:mm A")}
                            </span>
                            {isMe && <CheckCheck className="w-3 h-3 text-primary-foreground/95" />}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messageEndRef} />
            </div>

            {/* Input Form */}
            <div className="p-3 border-t bg-card">
              {canPost ? (
                recording ? (
                  /* Recording bar */
                  <div className="flex items-center gap-3 rounded-full bg-red-50 border border-red-200 px-4 py-2">
                    <span className="flex h-3 w-3 items-center justify-center">
                      <span className="absolute h-3 w-3 rounded-full bg-red-500 animate-ping" />
                      <span className="h-3 w-3 rounded-full bg-red-500" />
                    </span>
                    <span className="text-sm font-medium text-red-600 flex-1">
                      Recording… {Math.floor(recordSecs / 60)}:{String(recordSecs % 60).padStart(2, "0")}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => stopRecording(true)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      className="rounded-full h-9 w-9 shrink-0 bg-red-500 hover:bg-red-600 text-white"
                      onClick={() => stopRecording(false)}
                      title="Stop & send"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                <form onSubmit={handleSend} className="flex gap-2 items-center">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      isAnnouncement
                        ? "Post an announcement to this channel..."
                        : isDirect
                        ? `Message ${activeGroup.name}...`
                        : "Type your message..."
                    }
                    className="flex-1 bg-muted/20 border-muted-foreground/20 rounded-full focus-visible:ring-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={startRecording}
                    disabled={sendingVoice}
                    title="Record voice message"
                    className="rounded-full h-9 w-9 shrink-0 border border-muted-foreground/20 hover:bg-muted text-muted-foreground"
                  >
                    {sendingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                  </Button>
                  <Button type="submit" size="icon" disabled={!draft.trim()} className="rounded-full h-9 w-9 shrink-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
                )
              ) : (
                <div className="text-center text-xs py-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl flex items-center justify-center gap-2">
                  <Megaphone className="w-3.5 h-3.5 shrink-0" />
                  <span>Only administrators can post announcements to this channel.</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="w-16 h-16 mb-4 opacity-10" />
            <h3 className="font-bold text-lg">Select a conversation</h3>
            <p className="text-sm">Choose a channel, or start a private chat with the “New” button.</p>
          </div>
        )}
      </div>
    </div>
  );
}
