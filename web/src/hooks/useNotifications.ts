import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import toast from "react-hot-toast";
import { api, tokenStore } from "@/lib/api";
import type { ApiEnvelope, AppNotification, PageEnvelope } from "@/types";

const BASE = import.meta.env.VITE_API_URL || "";

async function fetchFeed() {
  const res = await api.get<PageEnvelope<AppNotification>>("/notifications?size=20");
  return res.data;
}

async function fetchUnreadCount() {
  const res = await api.get<ApiEnvelope<{ count: number }>>("/notifications/unread-count");
  return res.data.data?.count ?? 0;
}

export function useNotifications(userId?: number) {
  const qc = useQueryClient();

  const feed = useQuery({ queryKey: ["notifications"], queryFn: fetchFeed });
  const unread = useQuery({ queryKey: ["notifications", "unread"], queryFn: fetchUnreadCount });

  // Live updates over STOMP/SockJS.
  useEffect(() => {
    if (!userId || !tokenStore.access) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(`${BASE}/ws`),
      connectHeaders: { Authorization: `Bearer ${tokenStore.access}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe("/user/queue/notifications", (msg) => {
          try {
            const n = JSON.parse(msg.body) as AppNotification;
            toast(n.title, { icon: "🔔" });
          } catch {
            /* ignore malformed frame */
          }
          qc.invalidateQueries({ queryKey: ["notifications"] });
        });
        client.subscribe(`/topic/notifications/${userId}`, () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        });
      }
    });

    client.activate();
    return () => {
      client.deactivate();
    };
  }, [userId, qc]);

  async function markAllRead() {
    await api.post("/notifications/mark-all-read");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markRead(id: number) {
    await api.post(`/notifications/${id}/read`);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return {
    notifications: feed.data?.content ?? [],
    unreadCount: unread.data ?? 0,
    loading: feed.isLoading,
    markAllRead,
    markRead
  };
}
