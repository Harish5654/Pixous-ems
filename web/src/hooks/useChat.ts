import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { api, tokenStore } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const BASE = import.meta.env.VITE_API_URL || "";

export interface ChatMessage {
  messageId: number;
  communityId: number;
  senderId: number;
  senderName: string;
  content: string;
  sentAt: string;
  audioPath?: string;
  deleted?: boolean;
  isOptimistic?: boolean;
}

export interface CallSignal {
  senderId: number;
  senderName: string;
  type: string;
  data: any;
}

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

export function useChat(communityId: number | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // Call States
  const [callState, setCallState] = useState<"idle" | "calling" | "ringing" | "incoming" | "connected">("idle");
  const [activeCallPartner, setActiveCallPartner] = useState<{ id: number; name: string } | null>(null);
  const [callIsVideo, setCallIsVideo] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // WebRTC Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const stompClientRef = useRef<Client | null>(null);

  // Fetch initial history
  const history = useQuery({
    queryKey: ["chat_history", communityId],
    queryFn: async () => {
      if (!communityId) return [];
      const res = await api.get<ChatMessage[]>(`/communities/${communityId}/messages`);
      return res.data;
    },
    enabled: !!communityId
  });

  // Combine initial history + live messages (that are not in history)
  const allMessages = [...(history.data || []), ...liveMessages].reduce((acc, curr) => {
    if (!acc.find((m) => m.messageId === curr.messageId)) {
      acc.push(curr);
    }
    return acc;
  }, [] as ChatMessage[]).sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

  // WebSocket signaling (persistent connection)
  useEffect(() => {
    if (!tokenStore.access || !user) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${BASE}/ws`),
      connectHeaders: { Authorization: `Bearer ${tokenStore.access}` },
      reconnectDelay: 5000,
      onConnect: () => {
        stompClientRef.current = client;
        setIsConnected(true);

        // Subscribe to WebRTC calling signals for this user
        client.subscribe(`/topic/calls/${user.id}`, (msg) => {
          try {
            const signal = JSON.parse(msg.body) as CallSignal;
            handleIncomingSignal(signal);
          } catch (e) {
            console.error("Invalid calling signal payload", e);
          }
        });
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onWebSocketClose: () => {
        setIsConnected(false);
      }
    });

    client.activate();
    return () => {
      client.deactivate();
      stompClientRef.current = null;
      setIsConnected(false);
    };
  }, [user?.id]);

  // Dynamic subscription to the active community group messages
  useEffect(() => {
    setLiveMessages([]);
    if (!isConnected || !communityId || !stompClientRef.current) return;

    const subscription = stompClientRef.current.subscribe(`/topic/community/${communityId}`, (msg) => {
      try {
        const newMsg = JSON.parse(msg.body) as ChatMessage;

        // Deletion signal — remove the message everywhere.
        if (newMsg.deleted) {
          qc.setQueryData<ChatMessage[]>(["chat_history", communityId], (old) =>
            (old || []).filter(m => m.messageId !== newMsg.messageId)
          );
          setLiveMessages((prev) => prev.filter(m => m.messageId !== newMsg.messageId));
          return;
        }

        // 1. Instantly append to React Query's cached history
        qc.setQueryData<ChatMessage[]>(["chat_history", communityId], (old) => {
          const list = old || [];
          if (list.some(m => m.messageId === newMsg.messageId)) return list;
          return [...list, newMsg];
        });

        // 2. Remove any matching optimistic messages from liveMessages state
        setLiveMessages((prev) => prev.filter(m => !(m.isOptimistic && m.content === newMsg.content && m.senderId === newMsg.senderId)));
      } catch (e) {
        console.error("Invalid chat payload", e);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConnected, communityId, qc]);

  const sendSignal = async (recipientId: number, type: string, data: any) => {
    try {
      await api.post("/calls/signal", { recipientId, type, data });
    } catch (e) {
      console.error("Failed to send calling signal", e);
    }
  };

  const handleIncomingSignal = async (signal: CallSignal) => {
    const { senderId, senderName, type, data } = signal;

    switch (type) {
      case "calling":
        // Only accept if currently idle
        if (callState === "idle") {
          setActiveCallPartner({ id: senderId, name: senderName });
          setCallIsVideo(data?.isVideo || false);
          setCallState("incoming");
          // Send ringing signal back
          sendSignal(senderId, "ringing", null);
        } else {
          // Send busy / decline signal
          sendSignal(senderId, "decline", { reason: "busy" });
        }
        break;

      case "ringing":
        if (callState === "calling") {
          setCallState("ringing");
        }
        break;

      case "decline":
        cleanupCall();
        break;

      case "offer":
        if (callState === "incoming" || callState === "ringing" || callState === "idle") {
          setActiveCallPartner({ id: senderId, name: senderName });
          await setupPeerConnection(senderId, data?.isVideo || false);
          
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            sendSignal(senderId, "answer", { sdp: answer });
            setCallState("connected");
          }
        }
        break;

      case "answer":
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          setCallState("connected");
        }
        break;

      case "candidate":
        if (pcRef.current && data.candidate) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.error("Error adding received ICE candidate", e);
          }
        }
        break;

      case "hangup":
        cleanupCall();
        break;

      default:
        break;
    }
  };

  const setupPeerConnection = async (partnerId: number, isVideo: boolean) => {
    // 1. Get media devices stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideo,
        audio: true
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Create peer connection
      const pc = new RTCPeerConnection(iceServers);
      pcRef.current = pc;

      // 3. Add tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // 4. Handle remote stream track event
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // 5. Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(partnerId, "candidate", { candidate: event.candidate });
        }
      };
    } catch (err) {
      console.error("Failed to access camera/microphone", err);
      cleanupCall();
      throw err;
    }
  };

  const startCall = async (partnerId: number, partnerName: string, isVideo: boolean) => {
    if (callState !== "idle") return;
    
    setActiveCallPartner({ id: partnerId, name: partnerName });
    setCallIsVideo(isVideo);
    setCallState("calling");

    // Initiate signaling
    sendSignal(partnerId, "calling", { isVideo });

    // Setup local peer connection state
    try {
      await setupPeerConnection(partnerId, isVideo);
      
      // Generate WebRTC SDP offer
      if (pcRef.current) {
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        sendSignal(partnerId, "offer", { sdp: offer, isVideo });
      }
    } catch (e) {
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (callState !== "incoming" || !activeCallPartner) return;

    try {
      // Just waiting for SDP offer to establish. The offer event handles the peer setup.
      // Send signal back that user accepted
      sendSignal(activeCallPartner.id, "accept", null);
    } catch (e) {
      cleanupCall();
    }
  };

  const rejectCall = () => {
    if (activeCallPartner) {
      sendSignal(activeCallPartner.id, "decline", null);
    }
    cleanupCall();
  };

  const hangUp = () => {
    if (activeCallPartner) {
      sendSignal(activeCallPartner.id, "hangup", null);
    }
    cleanupCall();
  };

  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCallPartner(null);
    setCallState("idle");
  };

  const sendMsgMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!communityId) return;
      await api.post(`/communities/${communityId}/messages`, { content });
    }
  });

  const sendVoice = async (blob: Blob) => {
    if (!communityId) return;
    const fd = new FormData();
    fd.append("file", blob, "voice.webm");
    await api.post(`/communities/${communityId}/voice`, fd, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    // The saved message arrives via the WebSocket broadcast for this room.
  };

  const deleteMessage = async (messageId: number) => {
    await api.delete(`/communities/messages/${messageId}`);
    // Optimistic removal (the broadcast will also remove it for everyone).
    qc.setQueryData<ChatMessage[]>(["chat_history", communityId], (old) =>
      (old || []).filter(m => m.messageId !== messageId)
    );
    setLiveMessages((prev) => prev.filter(m => m.messageId !== messageId));
  };

  const handleSendMessage = async (content: string) => {
    if (!communityId || !user) return;

    const tempId = Date.now();
    const optimisticMsg: ChatMessage = {
      messageId: tempId,
      communityId,
      senderId: user.id,
      senderName: user.name,
      content,
      sentAt: new Date().toISOString(),
      isOptimistic: true
    };

    setLiveMessages((prev) => [...prev, optimisticMsg]);

    try {
      await sendMsgMutation.mutateAsync(content);
    } catch (err) {
      setLiveMessages((prev) => prev.filter(m => m.messageId !== tempId));
      throw err;
    }
  };

  return {
    messages: allMessages,
    isLoading: history.isLoading,
    sendMessage: handleSendMessage,
    sendVoice,
    deleteMessage,

    // Calling API
    callState,
    activeCallPartner,
    callIsVideo,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    rejectCall,
    hangUp
  };
}
