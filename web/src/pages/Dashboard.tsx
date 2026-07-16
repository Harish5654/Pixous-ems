import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Clock, CalendarCheck, LifeBuoy, Boxes, ArrowRight, Users, TrendingUp, AlertCircle, CheckCircle2, Briefcase, RefreshCw,
  Plus, Gift, Building2, UserPlus, UserMinus, MoreVertical, Receipt, Loader2, ChevronLeft,
  Check, X, Send, ListTodo, Inbox, Cake, Upload, Image as ImageIcon
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell
} from "recharts";
import dayjs from "dayjs";
import { api, apiMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, resolvePhotoUrl } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { minutesToHours, cn } from "@/lib/utils";
import type { ApiEnvelope, EmployeeDashboard, ExecutiveDashboard, UserSummary, PageEnvelope, PayslipRequest, LeaveRequest, Ticket, AttendanceRecord, EmployeeTaskGroup } from "@/types";
import toast from "react-hot-toast";

function AdvancedAnalytics({ userId }: { userId?: number }) {
  const analytics = useQuery({
    queryKey: ["pythonAnalytics", userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch(`http://localhost:8082/api/analytics/employee/${userId}`);
      if (!res.ok) throw new Error("Analytics service unavailable");
      return (await res.json()).data;
    }
  });

  if (analytics.isLoading) return <Skeleton className="h-48 w-full mt-6 rounded-xl" />;
  if (analytics.isError || !analytics.data) return null;

  const data = analytics.data;

  return (
    <Card className="mt-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">AI-Powered Insights</CardTitle>
        </div>
        <CardDescription>Generated via Python Microservice</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Work Hours Trend (Last 7 Days)</h4>
            <div className="h-32 flex flex-col justify-center items-center">
              {data.workHoursTrend && data.workHoursTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.workHoursTrend} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="hours" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorHours)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-xs text-muted-foreground p-4">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  No work hours logged in the last 7 days.
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-background rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">Punctuality Score</div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold font-display">{data.punctualityScore}%</span>
                <span className="text-xs mb-1 text-muted-foreground">{data.insight}</span>
              </div>
            </div>

            {data.highRiskLeaves?.length > 0 && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-warning font-medium text-xs mb-1">
                  <AlertCircle className="h-3 w-3" /> Leave Utilization Warning
                </div>
                <ul className="text-xs space-y-1 mt-2">
                  {data.highRiskLeaves.map((l: any, i: number) => (
                    <li key={i}><span className="font-semibold">{l.name}:</span> {l.warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon: Icon, label, value, hint, to, color = "primary"
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  to?: string;
  color?: "primary" | "success" | "warning" | "destructive" | "accent";
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
    success: "bg-success/15 text-success group-hover:bg-success group-hover:text-success-foreground",
    warning: "bg-warning/20 text-warning group-hover:bg-warning group-hover:text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground",
    accent: "bg-accent/20 text-accent-foreground group-hover:bg-accent group-hover:text-accent-foreground"
  };

  const body = (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-primary/5 h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-white/5 dark:to-transparent pointer-events-none" />
      <CardContent className="relative flex flex-col p-6 h-full justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300", colorMap[color])}>
              <Icon className="h-6 w-6" />
            </div>
            {to && (
              <div className="text-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <ArrowRight className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-3xl font-bold tracking-tight">{value}</div>
        </div>
        {hint && <div className="mt-4 text-xs font-medium text-muted-foreground/80 pt-4 border-t border-border/50">{hint}</div>}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

const COLORS = [
  "hsl(var(--primary))",    // Indigo
  "hsl(var(--accent))",     // Amber
  "hsl(var(--success))",    // Emerald
  "hsl(199, 89%, 48%)",     // Sky Blue
  "hsl(262, 83%, 58%)",     // Violet
  "hsl(330, 81%, 60%)"      // Pink
];

function ExecutiveStatCard({
  icon: Icon,
  label,
  value,
  trend,
  color,
  sparklineData,
  strokeColor,
  onClick
}: {
  icon: any;
  label: string;
  value: string | number;
  trend?: string;
  color: string;
  sparklineData: any[];
  strokeColor: string;
  onClick?: () => void;
}) {
  const isUp = trend && trend.startsWith("+");
  const isNoChange = trend && trend.includes("No change");

  return (
    <Card
      onClick={onClick}
      className={cn(
        "shadow-sm border-border/50 hover:shadow-md transition-shadow",
        onClick && "cursor-pointer hover:border-primary/40"
      )}
    >
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg bg-primary/10 text-primary", {
              "bg-success/10 text-success": color === "success",
              "bg-warning/10 text-warning": color === "warning",
              "bg-sky-500/10 text-sky-500": color === "sky",
              "bg-pink-500/10 text-pink-500": color === "pink"
            })}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
          </div>
        </div>

        <div className="flex items-end justify-between mt-4">
          <div>
            <span className="text-2xl font-extrabold tracking-tight text-foreground">{value}</span>
            {trend && (
              <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold">
                <span className={cn(
                  isUp ? "text-success" : isNoChange ? "text-muted-foreground" : "text-destructive"
                )}>
                  {trend}
                </span>
                <span className="text-muted-foreground font-normal">from last month</span>
              </div>
            )}
          </div>

          <div className="h-8 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (m?: number) => (m && m >= 1 && m <= 12 ? MONTHS[m - 1] : "");

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" inputMode="decimal" value={value} placeholder="0" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

interface GenForm {
  companyName: string;
  payDate: string;
  workingDays: string;
  basicSalary: string;
  hra: string;
  allowances: string;
  overtimePay: string;
  pfDeduction: string;
  esiDeduction: string;
  ptDeduction: string;
  tdsDeduction: string;
  otherDeductions: string;
}

const EMPTY_GEN: GenForm = {
  companyName: "Pixous Technologies",
  payDate: "",
  workingDays: "",
  basicSalary: "",
  hra: "",
  allowances: "",
  overtimePay: "",
  pfDeduction: "",
  esiDeduction: "",
  ptDeduction: "",
  tdsDeduction: "",
  otherDeductions: ""
};

/** Dashboard quick-access: review pending payslip requests and generate/reject inline. */
function PayslipApprovalsDialog({
  requests,
  loading,
  onClose
}: {
  requests: PayslipRequest[];
  loading: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [active, setActive] = useState<PayslipRequest | null>(null);
  const [form, setForm] = useState<GenForm>(EMPTY_GEN);
  const set = (k: keyof GenForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [companyLogo, setCompanyLogo] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const numOrUndef = (v: string) => (v.trim() === "" ? undefined : Number(v));

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<ApiEnvelope<{ path: string }>>("/payroll/requests/logo", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const path = res.data?.data?.path;
      if (path) {
        setCompanyLogo(path);
        toast.success("Logo uploaded");
      }
    } catch (err) {
      toast.error(apiMessage(err, "Logo upload failed"));
    } finally {
      setUploadingLogo(false);
    }
  }

  const approve = useMutation({
    mutationFn: async () => {
      if (!active) return;
      return api.post(`/payroll/requests/${active.id}/approve`, {
        companyName: form.companyName || undefined,
        companyLogo: companyLogo || undefined,
        employeeName: active.employeeName || undefined,
        employeeCode: active.employeeCode || undefined,
        payDate: form.payDate || undefined,
        workingDays: numOrUndef(form.workingDays),
        basicSalary: numOrUndef(form.basicSalary),
        hra: numOrUndef(form.hra),
        allowances: numOrUndef(form.allowances),
        overtimePay: numOrUndef(form.overtimePay),
        pfDeduction: numOrUndef(form.pfDeduction),
        esiDeduction: numOrUndef(form.esiDeduction),
        ptDeduction: numOrUndef(form.ptDeduction),
        tdsDeduction: numOrUndef(form.tdsDeduction),
        otherDeductions: numOrUndef(form.otherDeductions)
      });
    },
    onSuccess: () => {
      toast.success("Payslip generated and sent to employee");
      qc.invalidateQueries({ queryKey: ["payslip-requests"] });
      setActive(null);
      setCompanyLogo("");
    },
    onError: (err) => toast.error(apiMessage(err, "Could not generate payslip"))
  });

  const reject = useMutation({
    mutationFn: async (r: PayslipRequest) =>
      api.post(`/payroll/requests/${r.id}/reject`, { note: "Rejected by admin" }),
    onSuccess: () => {
      toast.success("Request rejected");
      qc.invalidateQueries({ queryKey: ["payslip-requests"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not reject request"))
  });

  const sum = (keys: (keyof GenForm)[]) =>
    keys.reduce((s, k) => s + (Number(form[k]) || 0), 0);
  const earnings = sum(["basicSalary", "hra", "allowances", "overtimePay"]);
  const deductions = sum(["pfDeduction", "esiDeduction", "ptDeduction", "tdsDeduction", "otherDeductions"]);
  const net = earnings - deductions;

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      {!active ? (
        <>
          <DialogHeader
            title="Payslip Approvals"
            description="Pending payslip requests — generate or reject right here."
          />
          {loading ? (
            <Skeleton className="h-32" />
          ) : requests.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No pending payslip requests. You're all caught up. 🎉
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {requests.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <Avatar name={r.employeeName} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{r.employeeName}</div>
                    <div className="text-xs text-muted-foreground">
                      {monthName(r.payMonth)} {r.payYear} · {r.employeeCode}
                      {r.note ? ` · "${r.note}"` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reject.isPending}
                    onClick={() => reject.mutate(r)}
                  >
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => { setForm({ ...EMPTY_GEN }); setCompanyLogo(""); setActive(r); }}>
                    <Receipt className="mr-1.5 h-4 w-4" /> Generate
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setActive(null)}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Back to requests
          </button>
          <DialogHeader
            title={`Generate payslip — ${active.employeeName}`}
            description={`${monthName(active.payMonth)} ${active.payYear} · ${active.employeeCode}`}
          />
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Earnings</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumField label="Basic" value={form.basicSalary} onChange={(v) => set("basicSalary", v)} />
                <NumField label="HRA" value={form.hra} onChange={(v) => set("hra", v)} />
                <NumField label="Allowances" value={form.allowances} onChange={(v) => set("allowances", v)} />
                <NumField label="Overtime" value={form.overtimePay} onChange={(v) => set("overtimePay", v)} />
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deductions</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <NumField label="PF" value={form.pfDeduction} onChange={(v) => set("pfDeduction", v)} />
                <NumField label="ESI" value={form.esiDeduction} onChange={(v) => set("esiDeduction", v)} />
                <NumField label="PT" value={form.ptDeduction} onChange={(v) => set("ptDeduction", v)} />
                <NumField label="TDS" value={form.tdsDeduction} onChange={(v) => set("tdsDeduction", v)} />
                <NumField label="Other" value={form.otherDeductions} onChange={(v) => set("otherDeductions", v)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Working days</Label>
                <Input type="number" value={form.workingDays} placeholder="e.g. 30" onChange={(e) => set("workingDays", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pay date</Label>
                <Input type="date" value={form.payDate} onChange={(e) => set("payDate", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Company logo</Label>
              <div className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
                {companyLogo ? (
                  <img
                    src={resolvePhotoUrl(companyLogo)}
                    alt="Company logo"
                    className="h-12 w-12 rounded-md border bg-white object-contain p-1"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    {companyLogo ? "Logo added to payslip" : "Upload a logo to show on the payslip (optional)"}
                  </p>
                  <div className="mt-1.5 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {uploadingLogo ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                      {companyLogo ? "Change" : "Upload logo"}
                    </Button>
                    {companyLogo && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setCompanyLogo("")}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadLogo}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Net pay <span className="text-xs">(earnings − deductions)</span>
              </span>
              <span className="text-lg font-bold text-primary">
                ₹{net.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
              {approve.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
              Generate &amp; Send
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status || "").toUpperCase();
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    OFFBOARDED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
  };
  return <Badge className={cn("border-0 text-[10px]", map[s] || "bg-muted text-muted-foreground")}>{s || "—"}</Badge>;
}

/** Clickable stat-card dialog: all employees / present today / on leave today. */
function EmployeeListDialog({ kind, onClose }: { kind: "total" | "present" | "leave" | "absent" | "offboard"; onClose: () => void }) {
  const title =
    kind === "total" ? "All Employees"
      : kind === "present" ? "Present Today"
      : kind === "absent" ? "Absent Today"
      : kind === "leave" ? "On Leave Today"
      : "Offboarded Employees";

  const users = useQuery({
    queryKey: ["users", "dash-list"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<PageEnvelope<UserSummary>>>("/users?size=300")).data.data.content
  });
  const present = useQuery({
    enabled: kind === "present" || kind === "absent",
    queryKey: ["attendance", "team", "dash"],
    retry: false,
    queryFn: async () => (await api.get<ApiEnvelope<AttendanceRecord[]>>("/attendance/team")).data.data
  });
  const onLeave = useQuery({
    enabled: kind === "leave",
    queryKey: ["leave", "on-leave", "dashboard"],
    retry: false,
    queryFn: async () => (await api.get<ApiEnvelope<LeaveRequest[]>>("/leave/on-leave")).data.data
  });

  const nameById = new Map<number, UserSummary>();
  (users.data ?? []).forEach((u) => nameById.set(u.id, u));

  let rows: { key: string; name: string; sub: string; extra?: React.ReactNode }[] = [];
  const loading =
    (kind === "total" || kind === "offboard") ? users.isLoading
      : (kind === "present" || kind === "absent") ? users.isLoading || present.isLoading
      : onLeave.isLoading;

  if (kind === "total") {
    rows = (users.data ?? []).map((u) => ({
      key: String(u.id),
      name: u.name,
      sub: `${u.employeeCode} · ${u.industry === "IT" ? "DIGITAL" : u.industry === "CIVIL" ? "INFRA" : u.industry || "—"}`,
      extra: <StatusBadge status={u.profileStatus} />
    }));
  } else if (kind === "offboard") {
    rows = (users.data ?? [])
      .filter((u) => u.profileStatus === "OFFBOARDED")
      .map((u) => ({
        key: String(u.id),
        name: u.name,
        sub: `${u.employeeCode} · ${u.industry === "IT" ? "DIGITAL" : u.industry === "CIVIL" ? "INFRA" : u.industry || "—"}`,
        extra: <StatusBadge status={u.profileStatus} />
      }));
  } else if (kind === "present") {
    rows = (present.data ?? [])
      .filter((a) => a.punchInAt)
      .map((a) => {
        const u = nameById.get(a.userId);
        return {
          key: String(a.id),
          name: u?.name || `User #${a.userId}`,
          sub: `${u?.employeeCode || ""} · in ${dayjs(a.punchInAt).format("h:mm A")}`,
          extra: <Badge className="border-0 bg-emerald-100 text-emerald-700 text-[10px] dark:bg-emerald-900/30 dark:text-emerald-400">{a.status || "PRESENT"}</Badge>
        };
      });
  } else if (kind === "absent") {
    const presentIds = new Set((present.data ?? []).filter((a) => a.punchInAt).map((a) => a.userId));
    rows = (users.data ?? [])
      .filter((u) => u.profileStatus === "ACTIVE" && !presentIds.has(u.id))
      .map((u) => ({
        key: String(u.id),
        name: u.name,
        sub: `${u.employeeCode} · ${u.industry === "IT" ? "DIGITAL" : u.industry === "CIVIL" ? "INFRA" : u.industry || "—"}`,
        extra: <Badge className="border-0 bg-rose-100 text-rose-700 text-[10px] dark:bg-rose-900/30 dark:text-rose-400">ABSENT</Badge>
      }));
  } else {
    rows = (onLeave.data ?? []).map((r) => ({
      key: String(r.id),
      name: r.employeeName,
      sub: `${r.leaveTypeName} · ${dayjs(r.fromDate).format("DD MMM")}–${dayjs(r.toDate).format("DD MMM")}`,
      extra: <Badge className="border-0 bg-amber-100 text-amber-700 text-[10px] dark:bg-amber-900/30 dark:text-amber-400">{r.workingDays}d</Badge>
    }));
  }

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <DialogHeader title={title} description={`${rows.length} ${rows.length === 1 ? "employee" : "employees"}`} />
      {loading ? (
        <Skeleton className="h-40" />
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {kind === "present" ? "No one has punched in today yet."
            : kind === "leave" ? "Nobody is on leave today."
            : kind === "absent" ? "Everyone is present today. 🎉"
            : kind === "offboard" ? "No offboarded employees found."
            : "No employees."}
        </div>
      ) : (
        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3 rounded-lg border p-2.5">
              <Avatar name={r.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground code-chip">{r.sub}</div>
              </div>
              {r.extra}
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}

/** Dashboard quick-access: approve / reject pending leave requests inline. */
function LeaveApprovalsDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const pending = useQuery({
    queryKey: ["leave", "pending", "dashboard"],
    retry: false,
    queryFn: async () => (await api.get<ApiEnvelope<LeaveRequest[]>>("/leave/pending")).data.data
  });
  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: string }) =>
      api.post(`/leave/${id}/decision`, { decision }),
    onSuccess: (_, v) => {
      toast.success(`Leave ${v.decision.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["leave"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Action failed"))
  });
  const rows = pending.data ?? [];

  return (
    <Dialog open onClose={onClose} className="max-w-xl">
      <DialogHeader title="Leave Approvals" description="Pending leave requests — approve or reject right here." />
      {pending.isLoading ? (
        <Skeleton className="h-32" />
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No pending leave requests. 🎉</div>
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <Avatar name={r.employeeName} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.employeeName}</div>
                <div className="text-xs text-muted-foreground">
                  {r.leaveTypeName} · {dayjs(r.fromDate).format("DD MMM")}–{dayjs(r.toDate).format("DD MMM YYYY")} · {r.workingDays}d
                  {r.reason ? ` · "${r.reason}"` : ""}
                </div>
              </div>
              <Button size="sm" variant="outline" disabled={decide.isPending}
                onClick={() => decide.mutate({ id: r.id, decision: "REJECTED" })}>
                <X className="mr-1 h-4 w-4" /> Reject
              </Button>
              <Button size="sm" disabled={decide.isPending}
                onClick={() => decide.mutate({ id: r.id, decision: "APPROVED" })}>
                <Check className="mr-1 h-4 w-4" /> Approve
              </Button>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}

function priorityColor(p?: string) {
  const s = (p || "").toUpperCase();
  return s === "HIGH" || s === "URGENT"
    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
    : s === "MEDIUM"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      : "bg-muted text-muted-foreground";
}

/** Dashboard quick-access: view & respond to helpdesk tickets inline. */
function HelpdeskQuickCard() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reply, setReply] = useState("");

  const tickets = useQuery({
    queryKey: ["tickets", "all", "dashboard"],
    retry: false,
    queryFn: async () => (await api.get<PageEnvelope<Ticket>>("/tickets/all?size=50")).data.content
  });

  const respond = useMutation({
    mutationFn: async ({ id, comment }: { id: number; comment: string }) =>
      api.post(`/tickets/${id}/comments`, { comment }),
    onSuccess: () => {
      toast.success("Response sent");
      setReply(""); setActiveId(null);
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not send response"))
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      api.post(`/tickets/${id}/status`, { status }),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not update status"))
  });

  const all = tickets.data ?? [];
  const openTickets = all.filter((t) => t.status !== "CLOSED" && t.status !== "RESOLVED");

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
          <LifeBuoy className="h-4 w-4 text-primary" /> Helpdesk
        </CardTitle>
        <Badge className="border-0 bg-primary/10 text-primary text-[10px]">{openTickets.length} open</Badge>
      </CardHeader>
      <CardContent>
        {tickets.isLoading ? (
          <Skeleton className="h-40" />
        ) : openTickets.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <Inbox className="mb-2 h-7 w-7" /> No open tickets. All resolved.
          </div>
        ) : (
          <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
            {openTickets.map((t) => (
              <div key={t.id} className="rounded-lg border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="truncate text-[11px] text-muted-foreground code-chip">
                      {t.ticketCode} · {t.raisedByName}
                    </div>
                  </div>
                  <Badge className={cn("border-0 text-[10px] shrink-0", priorityColor(t.priority))}>{t.priority}</Badge>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => { setActiveId(activeId === t.id ? null : t.id); setReply(""); }}
                  >
                    {activeId === t.id ? "Cancel" : "Reply"}
                  </button>
                  <button
                    className="text-xs font-medium text-emerald-600 hover:underline"
                    onClick={() => setStatus.mutate({ id: t.id, status: "RESOLVED" })}
                  >
                    Mark resolved
                  </button>
                </div>
                {activeId === t.id && (
                  <div className="mt-2 space-y-2">
                    <Textarea rows={2} placeholder="Type your response…" value={reply}
                      onChange={(e) => setReply(e.target.value)} />
                    <div className="flex justify-end">
                      <Button size="sm" disabled={!reply.trim() || respond.isPending}
                        onClick={() => respond.mutate({ id: t.id, comment: reply.trim() })}>
                        {respond.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                        Send
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Dashboard quick-access: assign a task to any employee (Digital/Infra) inline. */
function TasksQuickCard() {
  const qc = useQueryClient();
  const [industry, setIndustry] = useState<"IT" | "CIVIL">("IT");
  const [assignedTo, setAssignedTo] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [dueDate, setDueDate] = useState("");

  const employees = useQuery({
    queryKey: ["task-assign-emps", industry],
    queryFn: async () =>
      (await api.get<ApiEnvelope<PageEnvelope<UserSummary>>>(`/users?industry=${industry}&size=200`)).data.data.content
  });

  const assign = useMutation({
    mutationFn: async () =>
      api.post("/tasks", {
        title: title.trim(),
        description: desc.trim() || undefined,
        assignedTo: Number(assignedTo),
        dueDate: dueDate || undefined
      }),
    onSuccess: () => {
      toast.success("Task assigned");
      setTitle(""); setDesc(""); setAssignedTo(""); setDueDate("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => toast.error(apiMessage(err, "Could not assign task"))
  });

  const emps = employees.data ?? [];

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
          <ListTodo className="h-4 w-4 text-primary" /> Assign Task
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="flex gap-1.5 rounded-full border bg-muted/60 p-1">
          <button type="button" onClick={() => { setIndustry("IT"); setAssignedTo(""); }}
            className={cn("flex-1 rounded-full px-3 py-1 text-xs font-semibold transition-all",
              industry === "IT" ? "bg-sky-500 text-white shadow-sm" : "text-muted-foreground")}>
            Digital
          </button>
          <button type="button" onClick={() => { setIndustry("CIVIL"); setAssignedTo(""); }}
            className={cn("flex-1 rounded-full px-3 py-1 text-xs font-semibold transition-all",
              industry === "CIVIL" ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground")}>
            Infra
          </button>
        </div>
        <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          <option value="">{employees.isLoading ? "Loading…" : "Select employee"}</option>
          {emps.map((e) => (
            <option key={e.id} value={e.id}>{e.name} ({e.employeeCode})</option>
          ))}
        </Select>
        <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={2} placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Due date (optional)</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <Button className="w-full" disabled={!assignedTo || !title.trim() || assign.isPending}
          onClick={() => assign.mutate()}>
          {assign.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
          Assign Task
        </Button>
      </CardContent>
    </Card>
  );
}

const BIRTHDAYS = [
  { name: "Sarah Johnson", date: "May 25" },
  { name: "Sophia Martinez", date: "May 28" },
  { name: "Daniel Thomas", date: "May 30" },
  { name: "Olivia Jackson", date: "June 2" }
];

const EVENTS = [
  { date: "May 20", title: "Team Building Activity", time: "10:00 AM - 01:00 PM", tag: "Company Event", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { date: "May 24", title: "Project Deadline: Redesign", time: "11:59 PM", tag: "Important", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
  { date: "May 28", title: "Employee Feedback Session", time: "02:00 PM - 04:00 PM", tag: "Meeting", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" }
];

function ExecutiveAnalytics({ industry }: { industry: string }) {
  const analytics = useQuery({
    queryKey: ["pythonExecutiveAnalytics", industry],
    queryFn: async () => {
      const res = await fetch(`http://localhost:8082/api/analytics/executive?industry=${industry}`);
      if (!res.ok) throw new Error("Executive analytics service unavailable");
      return (await res.json()).data;
    }
  });

  if (analytics.isLoading) return <Skeleton className="h-44 w-full mt-6 rounded-xl animate-pulse" />;
  if (analytics.isError || !analytics.data) return null;

  const data = analytics.data;

  return (
    <Card className="mt-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">AI-Powered Organisation Insights</CardTitle>
        </div>
        <CardDescription>Python microservice-powered organizational analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm font-medium text-muted-foreground mb-4">
          {data.insight}
        </div>
        {data.departmentStats && data.departmentStats.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.departmentStats.map((d: any) => (
              <div key={d.department} className="bg-background border rounded-xl p-4 shadow-sm hover:shadow transition-shadow">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{d.department}</div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                  <div>
                    <div className="text-[10px] text-muted-foreground font-semibold">Attendance</div>
                    <div className="text-lg font-extrabold text-success">{d.attendanceRate}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground font-semibold">Late Rate</div>
                    <div className="text-lg font-extrabold text-warning">{d.lateRate}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground py-2 italic">
            No department level statistics available for this industry view yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExecutiveDashboardView({
  exec,
  recentUsers,
  user,
  selectedIndustry,
  setSelectedIndustry,
  emp,
  punch
}: {
  exec: any;
  recentUsers: any;
  user: any;
  selectedIndustry: string;
  setSelectedIndustry: (val: string) => void;
  emp: any;
  punch: any;
}) {
  const d = exec.data;
  const [payslipOpen, setPayslipOpen] = useState(false);
  const canApprovePayslips = !!user?.permissions?.includes("PAYROLL_RUN");

  const pendingPayslips = useQuery({
    queryKey: ["payslip-requests", "pending", "dashboard"],
    enabled: canApprovePayslips,
    retry: false,
    queryFn: async () =>
      (await api.get<ApiEnvelope<PayslipRequest[]>>("/payroll/requests?pendingOnly=true")).data.data
  });
  const pendingPayslipCount = pendingPayslips.data?.length ?? 0;

  // Quick-access state for clickable stat cards + leave approvals
  const [listKind, setListKind] = useState<"total" | "present" | "leave" | "absent" | "offboard" | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const canApproveLeave = !!user?.permissions?.includes("LEAVE_APPROVE");

  // Today's attendance (present punches) — used to derive the Absent count/list.
  const presentQuery = useQuery({
    queryKey: ["attendance", "team", "dash"],
    retry: false,
    queryFn: async () =>
      (await api.get<ApiEnvelope<AttendanceRecord[]>>("/attendance/team")).data.data
  });

  const leavePending = useQuery({
    queryKey: ["leave", "pending", "dashboard"],
    enabled: canApproveLeave,
    retry: false,
    queryFn: async () =>
      (await api.get<ApiEnvelope<LeaveRequest[]>>("/leave/pending")).data.data
  });
  const leavePendingCount = leavePending.data?.length ?? 0;

  // Real employees (with DOB) for the Upcoming Birthdays panel + task roles.
  const allUsersQuery = useQuery({
    queryKey: ["users", "dash-list"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<PageEnvelope<UserSummary>>>("/users?size=300")).data.data.content
  });

  // Recent tasks (replaces the Recent Employees table).
  const tasksAllQuery = useQuery({
    queryKey: ["tasks", "all", "dashboard-recent"],
    enabled: !!user?.permissions?.includes("USER_MANAGE"),
    retry: false,
    queryFn: async () =>
      (await api.get<ApiEnvelope<EmployeeTaskGroup[]>>("/tasks/all")).data.data
  });

  if (exec.isLoading) {
    return (
      <div className="space-y-6 pb-8 animate-pulse">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[340px] rounded-xl lg:col-span-1" />
          <Skeleton className="h-[340px] rounded-xl lg:col-span-1" />
          <Skeleton className="h-[340px] rounded-xl lg:col-span-1" />
        </div>
      </div>
    );
  }

  if (!d) return null;

  // Employee counts scoped to the selected industry (Overall / Digital / Infra),
  // computed from the live employee list + today's attendance.
  const usersLoaded = !!allUsersQuery.data;
  const inIndustry = (u: any) => selectedIndustry === "ALL" || u.industry === selectedIndustry;
  const scopedUsers = (allUsersQuery.data ?? []).filter(inIndustry);
  const activeEmployees = scopedUsers.filter((u) => u.profileStatus === "ACTIVE");
  const presentIdsToday = new Set(
    (presentQuery.data ?? []).filter((a) => a.punchInAt).map((a) => a.userId)
  );
  const totalCount = usersLoaded ? scopedUsers.length : d.headcount;
  const presentCount = usersLoaded
    ? activeEmployees.filter((u) => presentIdsToday.has(u.id)).length
    : d.presentToday;
  const offboardCount = scopedUsers.filter((u) => u.profileStatus === "OFFBOARDED").length;
  const absentCount = activeEmployees.filter((u) => !presentIdsToday.has(u.id)).length;

  const sparklineTotal = [
    { value: d.headcount - 50 }, { value: d.headcount - 30 }, { value: d.headcount - 40 },
    { value: d.headcount - 20 }, { value: d.headcount - 10 }, { value: d.headcount - 15 },
    { value: d.headcount }
  ];
  const sparklineActive = [
    { value: d.presentToday - 30 }, { value: d.presentToday - 10 }, { value: d.presentToday - 25 },
    { value: d.presentToday - 15 }, { value: d.presentToday - 5 }, { value: d.presentToday - 12 },
    { value: d.presentToday }
  ];
  const sparklineLeave = [
    { value: 12 }, { value: 18 }, { value: 14 }, { value: 20 },
    { value: 15 }, { value: 22 }, { value: d.headcount - d.presentToday }
  ];
  const sparklineDepts = [
    { value: 6 }, { value: 6 }, { value: 6 }, { value: 6 },
    { value: 6 }, { value: 6 }, { value: 6 }
  ];
  const sparklineHires = [
    { value: 1 }, { value: 3 }, { value: 2 }, { value: 4 },
    { value: 5 }, { value: 3 }, { value: Math.max(1, Math.round(d.headcount * 0.05)) }
  ];

  const employeeOverviewData = [
    { name: "1 May", employees: Math.round(d.headcount * 0.9) },
    { name: "6 May", employees: Math.round(d.headcount * 0.92) },
    { name: "11 May", employees: Math.round(d.headcount * 0.91) },
    { name: "16 May", employees: Math.round(d.headcount * 0.95) },
    { name: "21 May", employees: Math.round(d.headcount * 0.97) },
    { name: "26 May", employees: Math.round(d.headcount * 0.96) },
    { name: "31 May", employees: d.headcount }
  ];

  const deptData = d.departmentBreakdown && Object.keys(d.departmentBreakdown).length > 0
    ? Object.entries(d.departmentBreakdown).map(([name, count]) => ({
      name,
      value: Number(count)
    }))
    : [
      { name: "Engineering", value: 437 },
      { name: "Marketing", value: 250 },
      { name: "Sales", value: 187 },
      { name: "HR", value: 125 },
      { name: "Finance", value: 125 },
      { name: "Others", value: 124 }
    ];
  const totalDeptValue = deptData.reduce((acc, curr) => acc + curr.value, 0);

  const attendanceWeekData = [
    { name: "Mon", Present: Math.round(d.presentToday * 0.92), Absent: Math.round(d.presentToday * 0.08) },
    { name: "Tue", Present: Math.round(d.presentToday * 0.95), Absent: Math.round(d.presentToday * 0.05) },
    { name: "Wed", Present: Math.round(d.presentToday * 0.88), Absent: Math.round(d.presentToday * 0.12) },
    { name: "Thu", Present: Math.round(d.presentToday * 0.90), Absent: Math.round(d.presentToday * 0.10) },
    { name: "Fri", Present: Math.round(d.presentToday * 0.93), Absent: Math.round(d.presentToday * 0.07) },
    { name: "Sat", Present: Math.round(d.presentToday * 0.86), Absent: Math.round(d.presentToday * 0.14) }
  ];

  const maleCount = Math.round(d.headcount * 0.65);
  const femaleCount = d.headcount - maleCount;
  const fullTimeCount = Math.round(d.headcount * 0.88);
  const partTimeCount = d.headcount - fullTimeCount;

  return (
    <div className="space-y-6 pb-8">
      {/* Header welcome banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Good morning, {user?.name?.split(" ")[0] ?? "Admin"}! 👋
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Here's what's happening in your organization today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Industry Toggle */}
          <div className="flex gap-1.5 bg-muted/60 p-1.5 rounded-full border shadow-inner">
            <button
              type="button"
              onClick={() => setSelectedIndustry("ALL")}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-extrabold transition-all duration-200",
                selectedIndustry === "ALL"
                  ? "bg-white text-primary shadow-md scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Overall
            </button>
            <button
              type="button"
              onClick={() => setSelectedIndustry("IT")}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-extrabold transition-all duration-200",
                selectedIndustry === "IT"
                  ? "bg-sky-500 text-white shadow-md scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Digital
            </button>
            <button
              type="button"
              onClick={() => setSelectedIndustry("CIVIL")}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-extrabold transition-all duration-200",
                selectedIndustry === "CIVIL"
                  ? "bg-amber-500 text-white shadow-md scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Infra
            </button>
          </div>

          {emp?.data && (
            <Button
              variant="secondary"
              size="sm"
              disabled={punch.isPending}
              onClick={() => punch.mutate(emp.data.punchedInToday ? "punch-out" : "punch-in")}
              className="rounded-full shadow-sm hover:shadow-md transition-shadow"
            >
              {punch.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Clock className="mr-2 h-4 w-4" />
              )}
              {emp.data.punchedInToday ? "Punch Out" : "Punch In"}
            </Button>
          )}

          <Button size="sm" asChild className="rounded-xl shadow-sm hover:shadow-md transition-all gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95">
            <Link to="/employees">
              <Plus className="h-4 w-4" /> Add Employee
            </Link>
          </Button>
        </div>
      </div>

      {/* Six Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <ExecutiveStatCard
          icon={Users}
          label="Total Employees"
          value={totalCount}
          trend="click to view all"
          color="primary"
          sparklineData={sparklineTotal}
          strokeColor="hsl(var(--primary))"
          onClick={() => setListKind("total")}
        />
        <ExecutiveStatCard
          icon={CheckCircle2}
          label="Active Employees"
          value={presentCount}
          trend="present today"
          color="success"
          sparklineData={sparklineActive}
          strokeColor="hsl(var(--success))"
          onClick={() => setListKind("present")}
        />
        <ExecutiveStatCard
          icon={UserMinus}
          label="Offboard Employees"
          value={offboardCount}
          trend="click to view list"
          color="pink"
          sparklineData={[
            { value: offboardCount },
            { value: offboardCount },
            { value: offboardCount }
          ]}
          strokeColor="hsl(330, 81%, 60%)"
          onClick={() => setListKind("offboard")}
        />
        <ExecutiveStatCard
          icon={CalendarCheck}
          label="Absent"
          value={absentCount}
          trend="not present today"
          color="warning"
          sparklineData={sparklineLeave}
          strokeColor="hsl(var(--warning))"
          onClick={() => setListKind("absent")}
        />
        {/* Leave Approvals quick-access (replaces Departments) */}
        <button type="button" onClick={() => setLeaveOpen(true)} className="text-left h-full">
          <Card className="shadow-sm border-border/50 hover:shadow-md hover:border-primary/40 transition-all h-full">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-warning/10 text-warning">
                    <CalendarCheck className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Leave Approvals
                  </span>
                </div>
                {leavePendingCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {leavePendingCount}
                  </span>
                )}
              </div>
              <div className="flex items-end justify-between mt-4">
                <div>
                  <span className="text-2xl font-extrabold tracking-tight text-foreground">
                    {leavePendingCount}
                  </span>
                  <div className="mt-1 text-[10px] font-semibold text-muted-foreground">
                    {leavePendingCount > 0 ? "pending · approve/reject" : "all caught up"}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-primary" />
              </div>
            </CardContent>
          </Card>
        </button>
        <button type="button" onClick={() => setPayslipOpen(true)} className="text-left h-full">
          <Card className="shadow-sm border-border/50 hover:shadow-md hover:border-primary/40 transition-all h-full">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Payslip Approvals
                  </span>
                </div>
                {pendingPayslipCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {pendingPayslipCount}
                  </span>
                )}
              </div>
              <div className="flex items-end justify-between mt-4">
                <div>
                  <span className="text-2xl font-extrabold tracking-tight text-foreground">
                    {pendingPayslipCount}
                  </span>
                  <div className="mt-1 text-[10px] font-semibold text-muted-foreground">
                    {pendingPayslipCount > 0 ? "pending · click to generate" : "all caught up"}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-primary" />
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      {payslipOpen && (
        <PayslipApprovalsDialog
          requests={pendingPayslips.data ?? []}
          loading={pendingPayslips.isLoading}
          onClose={() => setPayslipOpen(false)}
        />
      )}

      {listKind && <EmployeeListDialog kind={listKind} onClose={() => setListKind(null)} />}
      {leaveOpen && <LeaveApprovalsDialog onClose={() => setLeaveOpen(false)} />}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Helpdesk quick-access (replaces Employee Overview) */}
        <HelpdeskQuickCard />

        {/* Tasks quick-access (replaces Employee by Department) */}
        <TasksQuickCard />

        {/* Attendance Overview Card */}
        <Card className="shadow-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground">Attendance Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-around gap-4 pb-3 border-b border-border/50">
              <div className="relative flex items-center justify-center h-24 w-24">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" className="stroke-muted" strokeWidth="8" fill="transparent" />
                  <circle cx="50" cy="50" r="40" className="stroke-primary" strokeWidth="8" fill="transparent" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - (d.attendancePercentToday || 86) / 100)} strokeLinecap="round" />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-xl font-bold">{d.attendancePercentToday || 86}%</span>
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Average</span>
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-success" />
                  <span className="text-muted-foreground font-semibold">Present:</span>
                  <span className="font-extrabold text-foreground">{d.presentToday}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-muted-foreground font-semibold">Absent:</span>
                  <span className="font-extrabold text-foreground">{Math.max(0, d.headcount - d.presentToday)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-muted-foreground font-semibold">Late:</span>
                  <span className="font-extrabold text-foreground">{Math.round(d.presentToday * 0.05)}</span>
                </div>
              </div>
            </div>

            <div className="h-[96px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceWeekData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={9} />
                  <YAxis tickLine={false} axisLine={false} fontSize={9} />
                  <Tooltip />
                  <Bar dataKey="Present" stackId="a" fill="hsl(var(--success))" maxBarSize={12} />
                  <Bar dataKey="Absent" stackId="a" fill="hsl(var(--destructive))" maxBarSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Tasks Table (replaces Recent Employees) */}
        <Card className="shadow-sm border-border/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-foreground">Recently assinged Tasks</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-lg">
              <Link to="/tasks">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {(() => {
              const rolesById = new Map<number, string[]>();
              (allUsersQuery.data ?? []).forEach((u) => rolesById.set(u.id, u.roles ?? []));
              const recentTasks = (tasksAllQuery.data ?? [])
                .flatMap((g) => g.tasks || [])
                .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
                .slice(0, 8);
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Employee</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Employee ID</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Industry</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Roles</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider">Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasksAllQuery.isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-9 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        </TableRow>
                      ))
                    ) : recentTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-xs font-medium">
                          No tasks assigned yet. Use “Assign Task” to create one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentTasks.map((t) => {
                        const roles = rolesById.get(t.assignedTo) ?? [];
                        const ind = t.assigneeIndustry;
                        const done = t.status === "COMPLETED";
                        return (
                          <TableRow key={t.id} className="hover:bg-muted/30">
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={t.assigneeName} className="h-7 w-7" />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-xs text-foreground truncate max-w-[130px]">{t.assigneeName}</span>
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{t.title}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-xs font-bold text-foreground">{t.assigneeCode}</TableCell>
                            <TableCell className="py-2.5">
                              <Badge className={`text-[9px] font-bold border-0 ${ind === "IT" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" : ind === "CIVIL" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
                                {ind === "IT" ? "DIGITAL" : ind === "CIVIL" ? "INFRA" : ind || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex gap-1">
                                {roles.slice(0, 1).map((r) => (
                                  <Badge key={r} className="code-chip text-[8px] font-bold">{r}</Badge>
                                ))}
                                {roles.length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge className={`text-[9px] font-bold border-0 ${done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                                {done ? "COMPLETED" : "PENDING"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-xs font-medium text-foreground">
                              {t.dueDate ? dayjs(t.dueDate).format("DD MMM YYYY") : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              );
            })()}
          </CardContent>
        </Card>

        {/* Right widgets column */}
        <div className="flex flex-col gap-6">
          {/* Upcoming Birthdays */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-foreground">Upcoming Birthdays</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-lg">
                <Link to="/employees">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {(() => {
                const today = dayjs();
                const ups = (allUsersQuery.data ?? [])
                  .filter((u) => u.dob)
                  .map((u) => {
                    const dob = dayjs(u.dob);
                    let next = dob.year(today.year());
                    if (next.isBefore(today, "day")) next = next.add(1, "year");
                    return { name: u.name, photoPath: u.photoPath, date: dob.format("MMM D"), daysUntil: next.diff(today, "day") };
                  })
                  .filter((b) => b.daysUntil <= 60)
                  .sort((a, b) => a.daysUntil - b.daysUntil)
                  .slice(0, 8);
                if (ups.length === 0) {
                  return (
                    <div className="flex h-24 flex-col items-center justify-center text-center text-xs text-muted-foreground">
                      <Cake className="mb-1.5 h-6 w-6" /> No birthdays in the next 60 days.
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                    {ups.map((b, i) => (
                      <div key={`${b.name}-${i}`} className="flex flex-col items-center">
                        <Avatar name={b.name} src={b.photoPath} className="h-9 w-9 ring-2 ring-primary/5 shadow-sm" />
                        <span className="text-[9px] font-bold mt-1 truncate w-14 block text-foreground">{b.name.split(" ")[0]}</span>
                        <span className="text-[8px] text-muted-foreground font-semibold mt-0.5">{b.date}</span>
                        <div className="mt-1 flex items-center justify-center h-4 w-4 rounded-full bg-primary/10 text-primary">
                          <Gift className="h-2.5 w-2.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card className="shadow-sm border-border/50 flex-1 flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-foreground">Upcoming Events</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-lg">
                <Link to="/helpdesk">View Calendar</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3.5">
                {EVENTS.map((e) => (
                  <div key={e.title} className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-center leading-none shrink-0">
                      <span className="text-[8px] uppercase tracking-wider">{e.date.split(" ")[0]}</span>
                      <span className="text-sm font-black">{e.date.split(" ")[1]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-foreground truncate max-w-[120px]">{e.title}</span>
                        <span className={cn("text-[7px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0", e.color)}>
                          {e.tag}
                        </span>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-medium block mt-0.5">{e.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <ExecutiveAnalytics industry={selectedIndustry} />
    </div>
  );
}

export default function DashboardPage() {
  const { user, hasPermission, hasRole } = useAuth();
  const isExec = hasPermission("DASHBOARD_EXEC");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("ALL");
  const queryClient = useQueryClient();

  const punch = useMutation({
    mutationFn: async (kind: "punch-in" | "punch-out") => {
      await api.post(`/attendance/${kind}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Attendance updated successfully!");
    },
    onError: (err) => {
      toast.error(apiMessage(err, "Failed to update attendance"));
    }
  });

  const emp = useQuery({
    queryKey: ["dashboard", "me"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<EmployeeDashboard>>("/dashboard/me")).data.data
  });

  const exec = useQuery({
    queryKey: ["dashboard", "exec", selectedIndustry],
    enabled: isExec,
    queryFn: async () => {
      const url = selectedIndustry === "ALL"
        ? "/dashboard/executive"
        : `/dashboard/executive?industry=${selectedIndustry}`;
      return (await api.get<ApiEnvelope<ExecutiveDashboard>>(url)).data.data;
    }
  });

  const recentUsers = useQuery({
    queryKey: ["dashboard", "recent-users"],
    enabled: isExec,
    queryFn: async () => {
      const res = await api.get<ApiEnvelope<PageEnvelope<UserSummary>>>("/users?size=5");
      return res.data.data.content;
    }
  });

  const greeting = (() => {
    const h = dayjs().hour();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const d = emp.data;

  // Transform leave balances for advanced chart
  const leaveChart = d?.leaveBalances?.map((b) => ({
    name: b.leaveTypeCode,
    fullName: b.leaveTypeName,
    Available: Number(b.available),
    Used: Number(b.used),
    Allocated: Number(b.allocated)
  })) ?? [];

  // Super Admin uses the employee-style dashboard (with the executive
  // "Organisation Pulse" band below) — the original layout. Other executive
  // roles (e.g. CEO) still get the dedicated charts view.
  if (isExec) {
    return (
      <ExecutiveDashboardView
        exec={exec}
        recentUsers={recentUsers}
        user={user}
        selectedIndustry={selectedIndustry}
        setSelectedIndustry={setSelectedIndustry}
        emp={emp}
        punch={punch}
      />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Dynamic Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-8 shadow-lg">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="absolute right-0 top-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-white opacity-10 blur-3xl"></div>

        {isExec && (
          <div className="absolute top-6 right-8 z-20 flex gap-2.5 bg-white/10 p-1.5 rounded-full border border-white/20 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setSelectedIndustry("ALL")}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm duration-300",
                selectedIndustry === "ALL"
                  ? "bg-white text-primary scale-105"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              )}
            >
              Overall
            </button>
            <button
              type="button"
              onClick={() => setSelectedIndustry("IT")}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm duration-300",
                selectedIndustry === "IT"
                  ? "bg-sky-500 text-white scale-105"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              )}
            >
              Digital
            </button>
            <button
              type="button"
              onClick={() => setSelectedIndustry("CIVIL")}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm duration-300",
                selectedIndustry === "CIVIL"
                  ? "bg-amber-500 text-white scale-105"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              )}
            >
              Infra
            </button>
          </div>
        )}

        <div className="relative z-10">
          <div className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 mb-4 text-sm font-medium backdrop-blur-sm">
            <CalendarCheck className="mr-2 h-4 w-4" />
            {dayjs().format("dddd, DD MMMM YYYY")}
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2">
            {greeting}, {user?.name?.split(" ")[0] ?? ""}
          </h1>
          <p className="text-primary-foreground/80 max-w-lg">
            Welcome to your dashboard. {d?.punchedInToday ? `You punched in at ${dayjs(d?.punchInAt).format("h:mm A")}. Have a great workday!` : "You haven't punched in yet today. Don't forget to mark your attendance!"}
          </p>

          {/* Quick Actions */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={punch.isPending}
              onClick={() => punch.mutate(d?.punchedInToday ? "punch-out" : "punch-in")}
              className="rounded-full shadow-sm hover:shadow-md transition-shadow"
            >
              {punch.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Clock className="mr-2 h-4 w-4" />
              )}
              {d?.punchedInToday ? "Punch Out" : "Punch In"}
            </Button>
            <Button variant="outline" size="sm" asChild className="rounded-full bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20 shadow-sm transition-all">
              <Link to="/attendance">
                <Clock className="mr-2 h-4 w-4" /> Attendance Log
              </Link>
            </Button>
            {!hasRole("SUPER_ADMIN") && (
              <Button variant="outline" size="sm" asChild className="rounded-full bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20 shadow-sm transition-all">
                <Link to="/leave">
                  <CalendarCheck className="mr-2 h-4 w-4" /> Apply Leave
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild className="rounded-full bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20 shadow-sm transition-all">
              <Link to="/helpdesk">
                <LifeBuoy className="mr-2 h-4 w-4" /> Raise Ticket
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Executive band */}
      {isExec && (
        <div className="mb-8 pt-4 border-t">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Organisation Pulse
            </h2>
          </div>
          {exec.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : exec.data ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Users} label="Total Headcount" value={exec.data.headcount} color="primary" />
              <StatCard
                icon={Clock}
                label="Present Today"
                value={`${exec.data.presentToday}`}
                hint={
                  <span className="flex items-center text-success">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> {exec.data.attendancePercentToday}% of workforce
                  </span>
                }
                color="success"
              />
              <StatCard
                icon={CalendarCheck}
                label="Leave Approvals"
                value={exec.data.pendingLeaveApprovals}
                hint={`${exec.data.pendingLeaveApprovals} requests awaiting decision`}
                to="/leave/approvals"
                color="warning"
              />
              <StatCard
                icon={LifeBuoy}
                label="Open Tickets"
                value={exec.data.openTickets}
                hint="Requires attention"
                to="/helpdesk"
                color="destructive"
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Personal widgets */}
      <div className="mb-4 flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-primary" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          My Overview
        </h2>
      </div>

      {emp.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : d ? (
        <>
          <div className={cn("grid gap-4 sm:grid-cols-2", hasRole("SUPER_ADMIN") ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
            <StatCard
              icon={Clock}
              label="Today's Status"
              value={d.punchedInToday ? "Punched In" : "Not In"}
              hint={
                d.punchInAt
                  ? <span className="text-success font-medium">Logged {minutesToHours(d.workedMinutesToday)}</span>
                  : "Tap Attendance to punch in"
              }
              to="/attendance"
              color={d.punchedInToday ? "success" : "primary"}
            />
            {!hasRole("SUPER_ADMIN") && (
              <StatCard
                icon={CalendarCheck}
                label="Pending Leaves"
                value={d.pendingLeaveRequests > 0 ? d.pendingLeaveRequests : ""}
                hint={d.pendingLeaveRequests > 0 ? "Awaiting approval" : "No pending requests"}
                to="/leave"
                color={d.pendingLeaveRequests > 0 ? "warning" : "primary"}
              />
            )}
            <StatCard icon={Boxes} label="My Assets" value={d.myAssets} hint="Assigned to you" to="/assets" color="accent" />
            <StatCard
              icon={LifeBuoy}
              label="Open Tickets"
              value={d.myOpenTickets}
              hint={d.myOpenTickets > 0 ? "Check for updates" : "All clear"}
              to="/helpdesk"
              color={d.myOpenTickets > 0 ? "destructive" : "primary"}
            />
          </div>

          <AdvancedAnalytics userId={user?.id} />

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {/* Advanced Leave balances chart */}
            {!hasRole("SUPER_ADMIN") && (
              <Card className="lg:col-span-2 shadow-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-lg">Leave Balance Analytics</CardTitle>
                    <CardDescription>Your current leave utilization</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/10">
                    <Link to="/leave">
                      Details <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {leaveChart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl">
                      <CalendarCheck className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
                      <p className="text-sm font-medium text-muted-foreground">No leave balances allocated yet.</p>
                    </div>
                  ) : (
                    <div className="h-[280px] w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={leaveChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={8}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} tickMargin={10} />
                          <YAxis tickLine={false} axisLine={false} fontSize={12} tickMargin={10} />
                          <Tooltip
                            cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                            contentStyle={{
                              borderRadius: '12px',
                              border: "1px solid hsl(var(--border))",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                              fontSize: 12,
                              padding: '12px'
                            }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                          <Bar dataKey="Available" name="Available Days" radius={[4, 4, 0, 0]} fill="hsl(var(--success))" maxBarSize={50} />
                          <Bar dataKey="Used" name="Used Days" radius={[4, 4, 0, 0]} fill="hsl(var(--destructive))" maxBarSize={50} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Interactive Timeline */}
            <Card className={cn("shadow-sm border-border/50 flex flex-col", hasRole("SUPER_ADMIN") ? "lg:col-span-3" : "")}>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Your latest notifications</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto max-h-[300px]">
                {d.recentNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
                    <p className="text-sm font-medium text-muted-foreground">Nothing new right now.</p>
                  </div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-border/60 space-y-6 pb-4">
                    {d.recentNotifications.map((n) => (
                      <div key={n.id} className="relative group">
                        {/* Timeline Node */}
                        <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20 group-hover:scale-125 transition-transform" />

                        <div className="flex flex-col">
                          <div className="font-medium text-sm text-foreground leading-tight">{n.title}</div>
                          {n.body && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</div>}
                          <div className="text-[11px] text-muted-foreground mt-2 font-medium bg-muted w-fit px-2 py-0.5 rounded-md">
                            {dayjs(n.createdAt).format("DD MMM, h:mm A")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-4" />
            <h3 className="font-semibold text-lg text-foreground">Couldn't load your dashboard</h3>
            <p className="text-sm text-muted-foreground mt-1">There was a problem fetching your data. Please try refreshing the page.</p>
            <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>Refresh Page</Button>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
