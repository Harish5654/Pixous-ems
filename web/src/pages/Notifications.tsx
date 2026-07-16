import { useNavigate } from "react-router-dom";
import { BellRing, CheckCheck } from "lucide-react";
import dayjs from "dayjs";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAllRead, markRead } = useNotifications(user?.id);

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Everything that needs your attention, in one place."
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" onClick={() => markAllRead()}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : null
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="You're all caught up"
          description="New alerts about leave, attendance, assets and tickets will appear here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={cn(
                "cursor-pointer transition-colors hover:bg-muted/40",
                !n.read && "border-l-4 border-l-primary"
              )}
              onClick={() => {
                if (!n.read) markRead(n.id);
                if (n.link) navigate(n.link);
              }}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                    <span className="font-medium">{n.title}</span>
                    {n.type && (
                      <Badge variant="secondary" className="text-[10px]">
                        {n.type}
                      </Badge>
                    )}
                  </div>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {dayjs(n.createdAt).format("DD MMM, h:mm A")}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
