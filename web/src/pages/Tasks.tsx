import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ListTodo, Loader2, Plus, Search, ChevronRight, ChevronDown,
  CheckCircle2, Clock, Trash2, CalendarDays
} from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type {
  ApiEnvelope, PageEnvelope, UserSummary, TaskItem, EmployeeTaskGroup
} from "@/types";

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
      </Badge>
    );
  }
  return (
    <Badge className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      <Clock className="mr-1 h-3 w-3" /> Pending
    </Badge>
  );
}

export default function TasksPage() {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("USER_MANAGE");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle={
          isAdmin
            ? "Assign tasks to employees and track completion across Digital and Infra teams."
            : "Your assigned tasks — mark them complete when done."
        }
      />
      <MyTasks />
      {isAdmin && <AdminTasks />}
    </div>
  );
}

// ---------------- Everyone: my assigned tasks ----------------

function MyTasks() {
  const qc = useQueryClient();
  const mine = useQuery({
    queryKey: ["tasks", "me"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<TaskItem[]>>("/tasks/me")).data.data
  });

  const complete = useMutation({
    mutationFn: async (id: number) => api.post(`/tasks/${id}/complete`),
    onSuccess: () => {
      toast.success("Task marked complete");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not update task"))
  });

  const tasks = mine.data ?? [];
  const pending = tasks.filter((t) => t.status !== "COMPLETED");
  const done = tasks.filter((t) => t.status === "COMPLETED");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>My Tasks</CardTitle>
          {pending.length > 0 && (
            <Badge className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {pending.length} pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {mine.isLoading ? (
          <Skeleton className="h-32" />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No tasks assigned"
            description="Tasks assigned to you by your admin will appear here."
          />
        ) : (
          <div className="space-y-2.5">
            {[...pending, ...done].map((t) => (
              <div
                key={t.id}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border p-3.5 sm:flex-row sm:items-center sm:justify-between",
                  t.status === "COMPLETED" && "opacity-70"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.title}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  {t.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {t.dueDate && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Due {dayjs(t.dueDate).format("DD MMM YYYY")}
                      </span>
                    )}
                    {t.assignerName && <span>Assigned by {t.assignerName}</span>}
                    {t.status === "COMPLETED" && t.completedAt && (
                      <span>Completed {dayjs(t.completedAt).format("DD MMM, h:mm A")}</span>
                    )}
                  </div>
                </div>
                {t.status !== "COMPLETED" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
                    disabled={complete.isPending}
                    onClick={() => complete.mutate(t.id)}
                  >
                    {complete.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    )}
                    Mark Complete
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- Admin: assign + everyone's tasks (Digital / Infra) ----------------

function AdminTasks() {
  const qc = useQueryClient();
  const [industry, setIndustry] = useState<"IT" | "CIVIL">("IT");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const all = useQuery({
    queryKey: ["tasks", "all", industry, q],
    queryFn: async () => {
      const params = new URLSearchParams({ industry });
      if (q) params.set("q", q);
      return (
        await api.get<ApiEnvelope<EmployeeTaskGroup[]>>(`/tasks/all?${params.toString()}`)
      ).data.data;
    }
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      toast.success("Task deleted");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not delete task"))
  });

  const groups = all.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All Employee Tasks</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            {/* Industry toggle */}
            <div className="flex gap-1.5 rounded-full border bg-muted/60 p-1">
              <button
                type="button"
                onClick={() => setIndustry("IT")}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                  industry === "IT"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                Digital
              </button>
              <button
                type="button"
                onClick={() => setIndustry("CIVIL")}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                  industry === "CIVIL"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                Infra
              </button>
            </div>
            <Button onClick={() => setShowAssign(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Assign Task
            </Button>
          </div>
        </div>
        <div className="relative mt-3 w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or employee ID…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {all.isLoading ? (
          <Skeleton className="h-40" />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No tasks yet"
            description={`No ${industry === "IT" ? "Digital" : "Infra"} employees have tasks. Use "Assign Task" to create one.`}
          />
        ) : (
          <div className="space-y-2">
            {groups.map((g) => {
              const open = expanded === g.userId;
              return (
                <div key={g.userId} className="rounded-lg border">
                  <button
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
                    onClick={() => setExpanded(open ? null : g.userId)}
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Avatar name={g.employeeName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{g.employeeName}</span>
                        <Badge variant="secondary" className="code-chip">{g.employeeCode}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {g.totalTasks} {g.totalTasks === 1 ? "task" : "tasks"} ·{" "}
                        {g.pendingTasks} pending · {g.completedTasks} completed
                      </div>
                    </div>
                  </button>

                  {open && (
                    <div className="space-y-2 border-t p-3">
                      {g.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex flex-col gap-2 rounded-md bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{t.title}</span>
                              <StatusBadge status={t.status} />
                            </div>
                            {t.description && (
                              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                                {t.description}
                              </p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              {t.dueDate && <span>Due {dayjs(t.dueDate).format("DD MMM YYYY")}</span>}
                              {t.createdAt && <span>Assigned {dayjs(t.createdAt).format("DD MMM YYYY")}</span>}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(t.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {showAssign && (
        <AssignTaskDialog
          defaultIndustry={industry}
          onClose={() => setShowAssign(false)}
        />
      )}
    </Card>
  );
}

// ---------------- Assign task dialog ----------------

interface AssignForm {
  industry: "IT" | "CIVIL";
  assignedTo: string;
  title: string;
  description: string;
  dueDate: string;
}

function AssignTaskDialog({
  defaultIndustry,
  onClose
}: {
  defaultIndustry: "IT" | "CIVIL";
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AssignForm>({
    industry: defaultIndustry,
    assignedTo: "",
    title: "",
    description: "",
    dueDate: ""
  });
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof AssignForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const employees = useQuery({
    queryKey: ["task-assign-employees", form.industry],
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<PageEnvelope<UserSummary>>>(
        `/users?industry=${form.industry}&size=200&page=0`
      );
      return res.data.data.content;
    }
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post("/tasks", {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assignedTo: Number(form.assignedTo),
        dueDate: form.dueDate || undefined
      }),
    onSuccess: () => {
      toast.success("Task assigned");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (err) => setError(apiMessage(err, "Could not assign task"))
  });

  function submit() {
    setError(null);
    if (!form.assignedTo) {
      setError("Please select an employee");
      return;
    }
    if (!form.title.trim()) {
      setError("Task title is required");
      return;
    }
    createMutation.mutate();
  }

  const emps = employees.data ?? [];

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <DialogHeader
        title="Assign Task"
        description="Assign a task to an employee. They'll see it in their Tasks and can mark it complete."
      />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Team</Label>
          <div className="flex gap-1.5 rounded-full border bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, industry: "IT", assignedTo: "" }))}
              className={cn(
                "flex-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                form.industry === "IT"
                  ? "bg-sky-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Digital
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, industry: "CIVIL", assignedTo: "" }))}
              className={cn(
                "flex-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                form.industry === "CIVIL"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Infra
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="task-emp">Employee *</Label>
          <Select
            id="task-emp"
            value={form.assignedTo}
            onChange={(e) => set("assignedTo", e.target.value)}
          >
            <option value="">
              {employees.isLoading ? "Loading…" : "Select an employee"}
            </option>
            {emps.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.employeeCode})
              </option>
            ))}
          </Select>
          {!employees.isLoading && emps.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No {form.industry === "IT" ? "Digital" : "Infra"} employees found.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="task-title">Task title *</Label>
          <Input
            id="task-title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Prepare site safety report"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="task-desc">Description</Label>
          <Textarea
            id="task-desc"
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Details about what needs to be done…"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="task-due">Due date</Label>
          <Input
            id="task-due"
            type="date"
            value={form.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={createMutation.isPending}>
          {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {createMutation.isPending ? "Assigning…" : "Assign Task"}
        </Button>
      </div>
    </Dialog>
  );
}
