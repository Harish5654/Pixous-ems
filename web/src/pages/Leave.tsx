import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, CalendarX2, X, FileSpreadsheet } from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import type { ApiEnvelope, PageEnvelope, LeaveType, LeaveBalance, LeaveRequest } from "@/types";
import { useAuth } from "@/hooks/useAuth";

const schema = z
  .object({
    leaveTypeId: z.string().min(1, "Choose a leave type"),
    fromDate: z.string().min(1, "Start date required"),
    toDate: z.string().min(1, "End date required"),
    reason: z.string().optional()
  })
  .refine((v) => v.toDate >= v.fromDate, {
    message: "End date can't be before start date",
    path: ["toDate"]
  });

type FormValues = z.infer<typeof schema>;

export default function LeavePage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState(dayjs().format("YYYY-MM"));

  if (hasRole("SUPER_ADMIN")) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <CalendarX2 className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="font-display text-lg font-semibold text-foreground">Restricted Access</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Super Admins do not have personal leave management profiles. Please use the Approvals or Leave Policies sections.
        </p>
      </div>
    );
  }

  const types = useQuery({
    queryKey: ["leave", "types"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<LeaveType[]>>("/leave/types")).data.data
  });

  const balances = useQuery({
    queryKey: ["leave", "balances"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<LeaveBalance[]>>("/leave/balances")).data.data
  });

  const requests = useQuery({
    queryKey: ["leave", "me"],
    queryFn: async () => {
      const res = await api.get<PageEnvelope<LeaveRequest>>("/leave/me?size=50");
      return res.data?.content || [];
    }
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const apply = useMutation({
    mutationFn: async (values: FormValues) =>
      api.post("/leave/apply", {
        leaveTypeId: Number(values.leaveTypeId),
        fromDate: values.fromDate,
        toDate: values.toDate,
        reason: values.reason || undefined
      }),
    onSuccess: () => {
      toast.success("Leave request submitted");
      qc.invalidateQueries({ queryKey: ["leave"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(apiMessage(err, "Could not submit leave"))
  });

  const cancel = useMutation({
    mutationFn: async (id: number) => api.post(`/leave/${id}/cancel`),
    onSuccess: () => {
      toast.success("Leave cancelled");
      qc.invalidateQueries({ queryKey: ["leave"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not cancel"))
  });

  function exportExcel() {
    const all: any[] = requests.data ?? [];
    // Leaves whose start date falls in the chosen month.
    const rows = all
      .filter((r) => r.fromDate && String(r.fromDate).startsWith(exportMonth))
      .sort((a, b) => String(a.fromDate).localeCompare(String(b.fromDate)));
    if (rows.length === 0) {
      toast.error(`No leaves found for ${dayjs(exportMonth).format("MMMM YYYY")}.`);
      return;
    }
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["S.No", "Leave Type", "From Date", "To Date", "Days", "Reason", "Status", "Applied On"];
    const lines = [header.map(esc).join(",")];
    rows.forEach((r, i) =>
      lines.push([
        i + 1,
        r.leaveTypeName,
        dayjs(r.fromDate).format("DD-MMM-YYYY"),
        dayjs(r.toDate).format("DD-MMM-YYYY"),
        r.workingDays,
        r.reason || "",
        r.status,
        r.createdAt ? dayjs(r.createdAt).format("DD-MMM-YYYY") : ""
      ].map(esc).join(","))
    );
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `My_Leaves_${exportMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Leave report downloaded");
  }

  // Merge all system leave types and user balance records to ensure every type has a card
  const mergedBalances = types.data?.map(t => {
    const bal = balances.data?.find(b => b.leaveTypeId === t.id);
    if (bal) {
      return {
        leaveTypeId: t.id,
        leaveTypeName: t.name,
        leaveTypeCode: t.code,
        allocated: Number(bal.allocated),
        available: Number(bal.available),
        used: Number(bal.used),
        hasAllocatedBalance: true
      };
    }
    
    // Count used days from request history for types without set balance in DB (like Loss of Pay)
    const usedCount = requests.data
      ?.filter(r => r.leaveTypeName === t.name && r.status === "APPROVED")
      ?.reduce((sum, r) => sum + r.workingDays, 0) || 0;
      
    const maxDays = t.maxDaysPerYear != null ? Number(t.maxDaysPerYear) : null;
      
    return {
      leaveTypeId: t.id,
      leaveTypeName: t.name,
      leaveTypeCode: t.code,
      allocated: maxDays ?? 0,
      available: maxDays != null ? Math.max(0, maxDays - usedCount) : 0,
      used: usedCount,
      hasAllocatedBalance: maxDays != null
    };
  }) || [];

  return (
    <div>
      <PageHeader
        title="Leave"
        subtitle="Check balances, apply, and track your requests."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={exportMonth}
              onChange={(e) => setExportMonth(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button variant="outline" onClick={exportExcel} className="bg-green-600 text-white hover:bg-green-700 border-0">
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export Excel
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Apply for leave
            </Button>
          </div>
        }
      />

      {/* Balances */}
      {balances.isLoading || types.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : mergedBalances.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No balances allocated"
          description="Leave balances for the year haven't been set up for your account yet."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mergedBalances.map((b) => {
            const pct = b.hasAllocatedBalance && b.allocated > 0 
              ? (b.available / b.allocated) * 100 
              : 0;
            return (
              <Card key={b.leaveTypeId}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{b.leaveTypeName}</span>
                    <Badge variant="secondary" className="code-chip">{b.leaveTypeCode}</Badge>
                  </div>
                  <div className="mt-2 flex items-end gap-1">
                    {b.hasAllocatedBalance ? (
                      <>
                        <span className="font-display text-3xl font-bold">{b.available}</span>
                        <span className="pb-1 text-sm text-muted-foreground">/ {b.allocated} left</span>
                      </>
                    ) : (
                      <>
                        <span className="font-display text-3xl font-bold">—</span>
                        <span className="pb-1 text-sm text-muted-foreground">/ Unlimited</span>
                      </>
                    )}
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: b.hasAllocatedBalance ? `${Math.max(4, Math.min(100, pct))}%` : "0%" }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{b.used} used</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* My requests */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>My requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.isLoading ? (
            <Skeleton className="h-40" />
          ) : (requests.data?.length ?? 0) === 0 ? (
            <EmptyState title="No leave requests yet" description="Applied leave will show here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Applied On</TableHead>
                  <TableHead>Leave Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.data!.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.leaveTypeName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dayjs(r.createdAt).format("DD MMM YYYY")}
                    </TableCell>
                    <TableCell>
                      {dayjs(r.fromDate).format("DD MMM YYYY")} – {dayjs(r.toDate).format("DD MMM YYYY")}
                    </TableCell>
                    <TableCell>{r.workingDays}</TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs" title={r.reason}>
                      {r.reason || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground" title={r.decisionComment}>
                      {r.decisionComment || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Apply dialog */}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader
          title="Apply for leave"
          description="Weekends and holidays are excluded from the day count automatically."
        />
        <form onSubmit={handleSubmit((v) => apply.mutate(v))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="leaveTypeId">Leave type</Label>
            <Select id="leaveTypeId" {...register("leaveTypeId")}>
              <option value="">Select…</option>
              {types.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </Select>
            {errors.leaveTypeId && (
              <p className="text-xs text-destructive">{errors.leaveTypeId.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fromDate">From</Label>
              <Input id="fromDate" type="date" {...register("fromDate")} />
              {errors.fromDate && (
                <p className="text-xs text-destructive">{errors.fromDate.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="toDate">To</Label>
              <Input id="toDate" type="date" {...register("toDate")} />
              {errors.toDate && (
                <p className="text-xs text-destructive">{errors.toDate.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea id="reason" rows={3} placeholder="Add a short note…" {...register("reason")} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={apply.isPending}>
              {apply.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit request
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
