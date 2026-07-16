import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin, LogIn, LogOut, Loader2, Building2, Home, HardHat, Calendar
} from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { minutesToHours, cn } from "@/lib/utils";
import type { ApiEnvelope, AttendanceRecord } from "@/types";
import { useAuth } from "@/hooks/useAuth";

type AttendanceSummaryType = {
  month: number; year: number; presentDays: number; wfhDays: number;
  lateDays: number; absentDays: number; totalOvertimeMinutes: number;
};

const MODES = [
  { value: "OFFICE", label: "Office", icon: Building2 },
  { value: "WFH", label: "Work from home", icon: Home },
  { value: "SITE", label: "Site / field", icon: HardHat }
];

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000
    });
  });
}

export default function AttendancePage() {
  const { hasPermission } = useAuth();
  const isEmployeeOnly = !hasPermission("ATTENDANCE_TEAM", "LEAVE_APPROVE", "USER_MANAGE", "REPORT_VIEW");
  const qc = useQueryClient();
  const [mode, setMode] = useState("OFFICE");
  const [locating, setLocating] = useState(false);

  const from = dayjs().startOf("month").format("YYYY-MM-DD");
  const to = dayjs().endOf("month").format("YYYY-MM-DD");
  const month = dayjs().month() + 1;
  const year = dayjs().year();

  const today = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<AttendanceRecord | null>>("/attendance/today")).data.data
  });

  const history = useQuery({
    queryKey: ["attendance", "me", from, to],
    queryFn: async () =>
      (await api.get<ApiEnvelope<AttendanceRecord[]>>(`/attendance/me?from=${from}&to=${to}`))
        .data.data
  });

  const summary = useQuery({
    queryKey: ["attendance", "summary", month, year],
    queryFn: async () =>
      (await api.get<ApiEnvelope<AttendanceSummaryType>>(
        `/attendance/me/summary?month=${month}&year=${year}`
      )).data.data
  });

  const punch = useMutation({
    mutationFn: async (kind: "punch-in" | "punch-out") => {
      setLocating(true);
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (mode !== "WFH") {
        try {
          const pos = await getPosition();
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch (e) {
          throw new Error("Location needed for office/site punch. Enable GPS and try again.");
        } finally {
          setLocating(false);
        }
      }
      setLocating(false);
      const res = await api.post<ApiEnvelope<AttendanceRecord>>(`/attendance/${kind}`, {
        latitude,
        longitude,
        mode
      });
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Recorded");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => {
      setLocating(false);
      toast.error(apiMessage(err, "Could not record attendance"));
    }
  });

  const t = today.data;
  const punchedIn = !!t?.punchInAt;
  const punchedOut = !!t?.punchOutAt;
  const busy = punch.isPending || locating;

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Punch in and out with location. Field punches are geofence-checked against your site."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Punch card */}
        <Card className={cn(isEmployeeOnly ? "lg:col-span-3" : "lg:col-span-1")}>
          <CardHeader>
            <CardTitle>Today · {dayjs().format("DD MMM")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Punch in</div>
                <div className="font-display text-lg font-semibold">
                  {t?.punchInAt ? dayjs(t.punchInAt).format("h:mm A") : "—"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Punch out</div>
                <div className="font-display text-lg font-semibold">
                  {t?.punchOutAt ? dayjs(t.punchOutAt).format("h:mm A") : "—"}
                </div>
              </div>
            </div>

            {t && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                {t.late && <Badge variant="destructive">Late</Badge>}
                {t.withinGeofence === false && (
                  <Badge variant="warning">Outside geofence</Badge>
                )}
                {t.workedMinutes ? (
                  <span className="text-muted-foreground">
                    {minutesToHours(t.workedMinutes)} worked
                  </span>
                ) : null}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mode</label>
              <Select value={mode} onChange={(e) => setMode(e.target.value)} disabled={punchedOut}>
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
              {mode !== "WFH" && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> We'll capture your GPS location on punch.
                </p>
              )}
            </div>

            {!punchedIn ? (
              <Button className="w-full" disabled={busy} onClick={() => punch.mutate("punch-in")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {locating ? "Getting location…" : "Punch in"}
              </Button>
            ) : !punchedOut ? (
              <Button
                variant="accent"
                className="w-full"
                disabled={busy}
                onClick={() => punch.mutate("punch-out")}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                {locating ? "Getting location…" : "Punch out"}
              </Button>
            ) : (
              <div className="rounded-lg bg-success/10 p-3 text-center text-sm font-medium text-success">
                Day complete — see you tomorrow.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Month summary */}
        {!isEmployeeOnly && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{dayjs().format("MMMM YYYY")} summary</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.isLoading ? (
                <Skeleton className="h-20" />
              ) : summary.data ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                  {[
                    { label: "Present", value: summary.data.presentDays, tone: "text-success" },
                    { label: "WFH", value: summary.data.wfhDays, tone: "text-primary" },
                    { label: "Late", value: summary.data.lateDays, tone: "text-accent-foreground" },
                    { label: "Absent", value: summary.data.absentDays, tone: "text-destructive" },
                    {
                      label: "Overtime",
                      value: minutesToHours(summary.data.totalOvertimeMinutes),
                      tone: "text-foreground"
                    }
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border p-3 text-center">
                      <div className={`font-display text-2xl font-bold ${s.tone}`}>{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>

      {/* History */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>This month</CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <Skeleton className="h-40" />
          ) : (history.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No attendance yet"
              description="Your punches for this month will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Worked</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data!
                  .slice()
                  .sort((a, b) => (a.workDate < b.workDate ? 1 : -1))
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {dayjs(r.workDate).format("ddd, DD MMM")}
                      </TableCell>
                      <TableCell>{r.punchInAt ? dayjs(r.punchInAt).format("h:mm A") : "—"}</TableCell>
                      <TableCell>{r.punchOutAt ? dayjs(r.punchOutAt).format("h:mm A") : "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{r.mode}</span>
                      </TableCell>
                      <TableCell>{minutesToHours(r.workedMinutes)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                          {r.late && <Badge variant="destructive">Late</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
