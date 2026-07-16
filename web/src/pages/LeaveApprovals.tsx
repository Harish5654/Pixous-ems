import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, Loader2, CheckCheck, Inbox, ListTodo, Clock } from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiEnvelope, LeaveRequest, EmployeeTaskGroup } from "@/types";

export default function LeaveApprovalsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const pending = useQuery({
    queryKey: ["leave", "pending"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<LeaveRequest[]>>("/leave/pending")).data.data
  });

  // Applicant task summary shown alongside each leave request (admins only —
  // fails soft for approvers without USER_MANAGE).
  const taskGroups = useQuery({
    queryKey: ["tasks", "all"],
    retry: false,
    queryFn: async () =>
      (await api.get<ApiEnvelope<EmployeeTaskGroup[]>>("/tasks/all")).data.data
  });

  const tasksByUser = useMemo(() => {
    const map = new Map<number, EmployeeTaskGroup>();
    (taskGroups.data ?? []).forEach((g) => map.set(g.userId, g));
    return map;
  }, [taskGroups.data]);

  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: string }) =>
      api.post(`/leave/${id}/decision`, { decision }),
    onSuccess: (_, v) => {
      toast.success(`Request ${v.decision.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["leave"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Action failed"))
  });

  const bulk = useMutation({
    mutationFn: async (decision: string) =>
      api.post("/leave/bulk-decision", {
        requestIds: Array.from(selected),
        decision
      }),
    onSuccess: (_, decision) => {
      toast.success(`${selected.size} request(s) ${decision.toLowerCase()}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["leave"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Bulk action failed"))
  });

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const list = pending.data ?? [];

  return (
    <div>
      <PageHeader
        title="Leave approvals"
        subtitle="Requests from your team, waiting on your decision."
        actions={
          selected.size > 0 ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={bulk.isPending}
                onClick={() => bulk.mutate("REJECTED")}
              >
                <X className="h-4 w-4" /> Reject {selected.size}
              </Button>
              <Button size="sm" disabled={bulk.isPending} onClick={() => bulk.mutate("APPROVED")}>
                {bulk.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                Approve {selected.size}
              </Button>
            </div>
          ) : null
        }
      />

      {pending.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing to approve"
          description="When your team applies for leave, requests will land here."
        />
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const checked = selected.has(r.id);
            return (
              <Card key={r.id} className={checked ? "ring-2 ring-primary" : ""}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(r.id)}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                    aria-label={`Select ${r.employeeName}'s request`}
                  />
                  <Avatar name={r.employeeName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.employeeName}</span>
                      <Badge variant="secondary">{r.leaveTypeName}</Badge>
                      <Badge variant="default" className="code-chip">
                        {r.workingDays}d
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {dayjs(r.fromDate).format("DD MMM")} – {dayjs(r.toDate).format("DD MMM YYYY")}
                    </div>
                    {r.reason && (
                      <div className="mt-1 truncate text-sm text-muted-foreground">
                        “{r.reason}”
                      </div>
                    )}
                    <TaskSummary group={tasksByUser.get(r.userId)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: r.id, decision: "REJECTED" })}
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: r.id, decision: "APPROVED" })}
                    >
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskSummary({ group }: { group?: EmployeeTaskGroup }) {
  const pending = (group?.tasks ?? []).filter((t) => t.status !== "COMPLETED");
  const total = group?.totalTasks ?? 0;
  const pendingCount = group?.pendingTasks ?? 0;

  return (
    <div className="mt-2 rounded-md border bg-muted/40 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-medium">
          <ListTodo className="h-3.5 w-3.5" /> Tasks
        </span>
        <Badge className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {pendingCount} pending
        </Badge>
        <span className="text-muted-foreground">{total} total</span>
      </div>
      {pending.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {pending.slice(0, 5).map((t) => (
            <li key={t.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0 text-amber-500" />
              <span className="truncate">{t.title}</span>
              {t.dueDate && (
                <span className="shrink-0 text-[11px]">· due {dayjs(t.dueDate).format("DD MMM")}</span>
              )}
            </li>
          ))}
          {pending.length > 5 && (
            <li className="text-[11px] text-muted-foreground">+{pending.length - 5} more…</li>
          )}
        </ul>
      ) : (
        <div className="mt-1 text-xs text-muted-foreground">No pending tasks.</div>
      )}
    </div>
  );
}
