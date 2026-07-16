import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Trash2, ClipboardList, Search, ChevronRight, ChevronDown, Save, FileSpreadsheet } from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import type { ApiEnvelope, WorkReport, EmployeeWorkList } from "@/types";

interface DraftRow {
  workDate: string;
  projectName: string;
  workHours: string;
  taskDescription: string;
}

const emptyDraft = (): DraftRow => ({
  workDate: dayjs().format("YYYY-MM-DD"),
  projectName: "",
  workHours: "7",
  taskDescription: ""
});

export default function WorkReportsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canSeeAll = hasPermission("REPORT_VIEW", "USER_MANAGE");
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));

  const exportMonthExcel = async () => {
    const toastId = toast.loading("Preparing work report export...");
    try {
      const res = await api.get<ApiEnvelope<WorkReport[]>>("/work-reports/me");
      const allReports = res.data.data || [];

      // Filter reports matching the selected month (YYYY-MM)
      const filtered = allReports.filter(r => 
        r.workDate && r.workDate.startsWith(selectedMonth)
      );

      if (filtered.length === 0) {
        toast.error(`No work reports found for ${dayjs(selectedMonth).format("MMMM YYYY")}.`, { id: toastId });
        return;
      }

      // Sort chronologically by date
      filtered.sort((a, b) => a.workDate.localeCompare(b.workDate));

      const headers = [
        "Date",
        "Project Name",
        "Hours Worked",
        "Task / Module Description"
      ];

      const rows = filtered.map(r => [
        `"${dayjs(r.workDate).format("DD MMM YYYY")}"`,
        `"${r.projectName.replace(/"/g, '""')}"`,
        `"${r.workHours}"`,
        `"${(r.taskDescription || "").replace(/"/g, '""')}"`
      ]);

      const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Work_Reports_${selectedMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Work report exported successfully!", { id: toastId });
    } catch (err) {
      console.error("Failed to export work reports:", err);
      toast.error("Failed to fetch work reports data.", { id: toastId });
    }
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <input 
        type="month"
        className="px-3 py-1.5 border rounded-md text-sm bg-background border-input shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
      />
      <Button
        onClick={exportMonthExcel}
        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-semibold transition-colors shadow-sm"
      >
        <FileSpreadsheet className="h-4 w-4" />
        <span className="hidden sm:inline">Export Month Excel</span>
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Reports"
        subtitle="Log your daily work — date, project, hours and what you did."
        actions={headerActions}
      />
      <MyWorkReports qc={qc} selectedMonth={selectedMonth} />
      {canSeeAll && <EmployeeWorkListSection />}
    </div>
  );
}

// ---------------- Employee: my rows (spreadsheet-style entry) ----------------

function MyWorkReports({ qc, selectedMonth }: { qc: ReturnType<typeof useQueryClient>; selectedMonth: string }) {
  const [draft, setDraft] = useState<DraftRow>(emptyDraft());

  const mine = useQuery({
    queryKey: ["work-reports", "me"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<WorkReport[]>>("/work-reports/me")).data.data
  });

  const add = useMutation({
    mutationFn: async () =>
      api.post("/work-reports", {
        workDate: draft.workDate,
        projectName: draft.projectName,
        workHours: Number(draft.workHours) || 0,
        taskDescription: draft.taskDescription || undefined
      }),
    onSuccess: () => {
      toast.success("Work report saved");
      qc.invalidateQueries({ queryKey: ["work-reports"] });
      setDraft(emptyDraft());
    },
    onError: (err) => toast.error(apiMessage(err, "Could not save"))
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/work-reports/${id}`),
    onSuccess: () => {
      toast.success("Row deleted");
      qc.invalidateQueries({ queryKey: ["work-reports"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not delete"))
  });

  function submit() {
    if (!draft.projectName.trim()) {
      toast.error("Project name is required");
      return;
    }
    add.mutate();
  }

  const allRows = mine.data ?? [];
  const rows = allRows.filter(r => r.workDate && r.workDate.startsWith(selectedMonth));

  return (
    <Card>
      <CardHeader>
        <CardTitle>My work log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">S.No</TableHead>
                <TableHead className="w-36">Date</TableHead>
                <TableHead className="w-48">Project Name</TableHead>
                <TableHead className="w-24">Hours</TableHead>
                <TableHead>Task / Module Description</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* entry row */}
              <TableRow className="bg-muted/40">
                <TableCell className="text-muted-foreground">+</TableCell>
                <TableCell>
                  <Input
                    type="date"
                    value={draft.workDate}
                    onChange={(e) => setDraft({ ...draft, workDate: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Project"
                    value={draft.projectName}
                    onChange={(e) => setDraft({ ...draft, projectName: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.5"
                    value={draft.workHours}
                    onChange={(e) => setDraft({ ...draft, workHours: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Textarea
                    rows={1}
                    placeholder="What did you work on?"
                    value={draft.taskDescription}
                    onChange={(e) => setDraft({ ...draft, taskDescription: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Button size="sm" onClick={submit} disabled={add.isPending}>
                    {add.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>

              {mine.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-20" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={ClipboardList}
                      title="No entries yet"
                      description="Add your first work report using the row above."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">{rows.length - i}</TableCell>
                    <TableCell>{dayjs(r.workDate).format("DD-MMM-YYYY")}</TableCell>
                    <TableCell className="font-medium">{r.projectName}</TableCell>
                    <TableCell>{r.workHours}h</TableCell>
                    <TableCell className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {r.taskDescription}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- HR / Admin: everyone's work, grouped + searchable ----------------

function EmployeeWorkListSection() {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const all = useQuery({
    queryKey: ["work-reports", "all", q],
    queryFn: async () =>
      (await api.get<ApiEnvelope<EmployeeWorkList[]>>(
        `/work-reports/all${q ? `?q=${encodeURIComponent(q)}` : ""}`
      )).data.data
  });

  const groups = all.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Employee Work List</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or employee ID…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {all.isLoading ? (
          <Skeleton className="h-40" />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No work reports"
            description="When employees log work, they'll be grouped here by person."
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
                        {g.totalRows} {g.totalRows === 1 ? "entry" : "entries"} · {g.totalHours}h total
                      </div>
                    </div>
                  </button>

                  {open && (
                    <div className="overflow-x-auto border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">S.No</TableHead>
                            <TableHead className="w-36">Date</TableHead>
                            <TableHead className="w-48">Project</TableHead>
                            <TableHead className="w-20">Hours</TableHead>
                            <TableHead>Task / Module</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {g.rows.map((r, i) => (
                            <TableRow key={r.id}>
                              <TableCell className="text-muted-foreground">{g.rows.length - i}</TableCell>
                              <TableCell>{dayjs(r.workDate).format("DD-MMM-YYYY")}</TableCell>
                              <TableCell className="font-medium">{r.projectName}</TableCell>
                              <TableCell>{r.workHours}h</TableCell>
                              <TableCell className="whitespace-pre-wrap text-sm text-muted-foreground">
                                {r.taskDescription}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
