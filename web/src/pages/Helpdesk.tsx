import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Loader2, LifeBuoy, Send, Star, MessageSquare
} from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ApiEnvelope, PageEnvelope, Ticket } from "@/types";

const STATUSES = ["OPEN", "IN_PROGRESS", "AWAITING_PARTS", "RESOLVED", "CLOSED"];

function priorityVariant(p: string) {
  switch (p) {
    case "CRITICAL":
    case "HIGH":
      return "destructive" as const;
    case "MEDIUM":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export default function HelpdeskPage() {
  const { hasPermission } = useAuth();
  const isAgent = hasPermission("HELPDESK_AGENT");
  // HR / Admin / execs can oversee every ticket in the org.
  const canSeeAll = hasPermission("USER_MANAGE") || hasPermission("DASHBOARD_EXEC");
  const [tab, setTab] = useState<"mine" | "queue" | "all">("mine");
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const mine = useQuery({
    queryKey: ["tickets", "mine"],
    queryFn: async () =>
      (await api.get<PageEnvelope<Ticket>>("/tickets?size=50")).data.content
  });

  const queue = useQuery({
    queryKey: ["tickets", "queue"],
    enabled: isAgent && tab === "queue",
    queryFn: async () =>
      (await api.get<PageEnvelope<Ticket>>("/tickets/assigned-to-me?size=50")).data.content
  });

  const all = useQuery({
    queryKey: ["tickets", "all"],
    enabled: canSeeAll && tab === "all",
    queryFn: async () =>
      (await api.get<PageEnvelope<Ticket>>("/tickets/all?size=50")).data.content
  });

  const list = tab === "queue" ? queue.data ?? [] : tab === "all" ? all.data ?? [] : mine.data ?? [];
  const loading = tab === "queue" ? queue.isLoading : tab === "all" ? all.isLoading : mine.isLoading;

  const tabs: Array<{ id: "mine" | "queue" | "all"; label: string }> = [
    { id: "mine", label: "My tickets" },
    ...(isAgent ? [{ id: "queue" as const, label: "Assigned to me" }] : []),
    ...(canSeeAll ? [{ id: "all" as const, label: "All tickets" }] : [])
  ];

  return (
    <div>
      <PageHeader
        title="Helpdesk"
        subtitle="Raise IT and facility requests, track progress, and rate resolutions."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New ticket
          </Button>
        }
      />

      {tabs.length > 1 && (
        <div className="mb-4 inline-flex rounded-lg border bg-card p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={tab === "queue" ? "Your queue is clear" : tab === "all" ? "No tickets in the system" : "No tickets yet"}
          description={
            tab === "queue"
              ? "Tickets assigned to you will show up here."
              : tab === "all"
              ? "Once employees raise tickets they will all appear here."
              : "Raise a ticket for IT support or on-site facilities."
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setOpenId(t.id)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="code-chip text-xs text-muted-foreground">{t.ticketCode}</span>
                    <span className="truncate font-medium">{t.title}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{t.type}</Badge>
                    {t.category && <span>{t.category}</span>}
                    <span>· {dayjs(t.createdAt).format("DD MMM")}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge>
                  <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {createOpen && <CreateTicketDialog onClose={() => setCreateOpen(false)} />}
      {openId != null && (
        <TicketDetail id={openId} isAgent={isAgent} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

interface CreateForm {
  title: string;
  type: string;
  category: string;
  priority: string;
  description: string;
}

function CreateTicketDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<CreateForm>({
    defaultValues: { type: "IT", priority: "MEDIUM" }
  });

  const create = useMutation({
    mutationFn: async (v: CreateForm) => api.post("/tickets", v),
    onSuccess: () => {
      toast.success("Ticket raised");
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (err) => toast.error(apiMessage(err, "Could not raise ticket"))
  });

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title="New ticket" description="Describe the issue and set a priority." />
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" placeholder="Short summary" {...register("title", { required: true })} />
          {errors.title && <p className="text-xs text-destructive">Title is required</p>}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Select id="type" {...register("type")}>
              <option value="IT">IT</option>
              <option value="FACILITY">Facility</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Input id="category" placeholder="Hardware…" {...register("category")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priority">Priority</Label>
            <Select id="priority" {...register("priority")}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={4} {...register("description")} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Raise ticket
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function TicketDetail({
  id, isAgent, onClose
}: {
  id: number;
  isAgent: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [comment, setComment] = useState("");

  const detail = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => (await api.get<ApiEnvelope<Ticket>>(`/tickets/${id}`)).data.data
  });

  const t = detail.data;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ticket", id] });
    qc.invalidateQueries({ queryKey: ["tickets"] });
  };

  const addComment = useMutation({
    mutationFn: async () => api.post(`/tickets/${id}/comments`, { comment }),
    onSuccess: () => {
      setComment("");
      invalidate();
    },
    onError: (err) => toast.error(apiMessage(err, "Could not add comment"))
  });

  const changeStatus = useMutation({
    mutationFn: async (status: string) => api.post(`/tickets/${id}/status`, { status }),
    onSuccess: () => {
      toast.success("Status updated");
      invalidate();
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not update status"))
  });

  const rate = useMutation({
    mutationFn: async (rating: number) => api.post(`/tickets/${id}/rating`, { rating }),
    onSuccess: () => {
      toast.success("Thanks for the feedback");
      invalidate();
    },
    onError: (err) => toast.error(apiMessage(err, "Could not submit rating"))
  });

  const isRequester = user?.id === t?.raisedBy;
  const canRate = isRequester && (t?.status === "RESOLVED" || t?.status === "CLOSED");

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      {detail.isLoading || !t ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <div className="mb-4 pr-8">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="code-chip text-xs text-muted-foreground">{t.ticketCode}</span>
              <Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge>
              <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
            </div>
            <h2 className="font-display text-xl font-bold">{t.title}</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              Raised by {t.raisedByName} · {dayjs(t.createdAt).format("DD MMM YYYY, h:mm A")}
            </div>
          </div>

          {t.description && (
            <p className="rounded-lg bg-muted/50 p-3 text-sm">{t.description}</p>
          )}

          {/* Agent status controls */}
          {isAgent && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Set status:</span>
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  variant={t.status === s ? "default" : "outline"}
                  size="sm"
                  disabled={changeStatus.isPending}
                  onClick={() => changeStatus.mutate(s)}
                >
                  {s.replace("_", " ")}
                </Button>
              ))}
            </div>
          )}

          {/* Rating */}
          {canRate && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm font-medium">Rate this resolution:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => rate.mutate(n)}
                    disabled={rate.isPending}
                    aria-label={`${n} star`}
                  >
                    <Star
                      className={cn(
                        "h-5 w-5 transition-colors",
                        (t.rating ?? 0) >= n
                          ? "fill-accent text-accent"
                          : "text-muted-foreground hover:text-accent"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="mt-6">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4" /> Conversation
            </div>
            <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
              {(t.comments?.length ?? 0) === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No comments yet.
                </p>
              ) : (
                t.comments!.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar name={c.authorName} className="h-8 w-8 text-xs" />
                    <div className="min-w-0 flex-1 rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{c.authorName}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {dayjs(c.createdAt).format("DD MMM, h:mm A")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm">{c.comment}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <Input
                placeholder="Write a reply…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && comment.trim()) addComment.mutate();
                }}
              />
              <Button
                disabled={!comment.trim() || addComment.isPending}
                onClick={() => addComment.mutate()}
              >
                {addComment.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </Dialog>
  );
}
