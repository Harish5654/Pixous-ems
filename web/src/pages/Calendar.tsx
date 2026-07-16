import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import {
  ChevronLeft, ChevronRight, CalendarDays, RefreshCw, Palmtree, Plane, CalendarCheck
} from "lucide-react";
import { api } from "@/lib/api";
import type { ApiEnvelope } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Holiday {
  id: number;
  name: string;
  holidayDate: string;
  state?: string;
}
interface LeaveItem {
  id: number;
  fromDate: string;
  toDate: string;
  status: string;
  leaveTypeName: string;
  reason?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHOWN_LEAVE_STATUSES = new Set(["APPROVED", "PENDING"]);
const FMT = "YYYY-MM-DD";

const leaveDot = (status: string) =>
  status === "APPROVED" ? "bg-emerald-500" : "bg-amber-500";
const leaveText = (status: string) =>
  status === "APPROVED"
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-amber-700 dark:text-amber-400";

export default function CalendarPage() {
  const [cursor, setCursor] = useState<Dayjs>(dayjs().startOf("month"));
  const [selected, setSelected] = useState<string>(dayjs().format(FMT));
  const year = cursor.year();

  const holidaysQ = useQuery({
    queryKey: ["calendar", "holidays", year],
    queryFn: async () =>
      (await api.get<ApiEnvelope<Holiday[]>>(`/org/holidays?year=${year}`)).data.data ?? []
  });

  const leavesQ = useQuery({
    queryKey: ["calendar", "leaves"],
    queryFn: async () => {
      const res = await api.get<{ content?: LeaveItem[] }>("/leave/me?size=200");
      return res.data?.content ?? [];
    }
  });

  const holidaysByDate = useMemo(() => {
    const m: Record<string, Holiday[]> = {};
    (holidaysQ.data ?? []).forEach((h) => {
      const d = dayjs(h.holidayDate).format(FMT);
      (m[d] ||= []).push(h);
    });
    return m;
  }, [holidaysQ.data]);

  const leavesByDate = useMemo(() => {
    const m: Record<string, LeaveItem[]> = {};
    (leavesQ.data ?? []).forEach((l) => {
      if (!SHOWN_LEAVE_STATUSES.has(l.status)) return;
      let d = dayjs(l.fromDate);
      const end = dayjs(l.toDate);
      let guard = 0;
      while ((d.isBefore(end) || d.isSame(end, "day")) && guard < 400) {
        (m[d.format(FMT)] ||= []).push(l);
        d = d.add(1, "day");
        guard++;
      }
    });
    return m;
  }, [leavesQ.data]);

  const gridStart = cursor.startOf("month").startOf("week");
  const days: Dayjs[] = Array.from({ length: 42 }, (_, i) => gridStart.add(i, "day"));
  const todayStr = dayjs().format(FMT);

  const selHolidays = holidaysByDate[selected] ?? [];
  const selLeaves = leavesByDate[selected] ?? [];

  const upcomingHolidays = (holidaysQ.data ?? [])
    .filter((h) => !dayjs(h.holidayDate).isBefore(dayjs(), "day"))
    .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate))
    .slice(0, 5);

  const upcomingLeaves = (leavesQ.data ?? [])
    .filter((l) => SHOWN_LEAVE_STATUSES.has(l.status) && !dayjs(l.toDate).isBefore(dayjs(), "day"))
    .sort((a, b) => a.fromDate.localeCompare(b.fromDate))
    .slice(0, 5);

  const loading = holidaysQ.isLoading || leavesQ.isLoading;

  const refresh = () => {
    holidaysQ.refetch();
    leavesQ.refetch();
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Company holidays and your leave schedule at a glance.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-lg">{cursor.format("MMMM YYYY")}</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setCursor(dayjs().startOf("month"))}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCursor((c) => c.subtract(1, "month"))}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCursor((c) => c.add(1, "month"))}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[420px] w-full rounded-lg" />
            ) : (
              <>
                {/* Weekday header */}
                <div className="mb-1 grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((w) => (
                    <div
                      key={w}
                      className="py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {w}
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map((d) => {
                    const ds = d.format(FMT);
                    const inMonth = d.month() === cursor.month();
                    const isToday = ds === todayStr;
                    const isWeekend = d.day() === 0 || d.day() === 6;
                    const hs = holidaysByDate[ds] ?? [];
                    const ls = leavesByDate[ds] ?? [];
                    const isSelected = ds === selected;

                    return (
                      <button
                        key={ds}
                        onClick={() => setSelected(ds)}
                        className={cn(
                          "flex min-h-[74px] flex-col rounded-lg border p-1.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/40",
                          !inMonth && "opacity-40",
                          isWeekend && inMonth && "bg-muted/40",
                          isSelected && "border-primary ring-1 ring-primary"
                        )}
                      >
                        <span
                          className={cn(
                            "mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                            isToday && "bg-primary text-primary-foreground",
                            !isToday && "text-foreground"
                          )}
                        >
                          {d.date()}
                        </span>
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          {hs.slice(0, 1).map((h) => (
                            <span
                              key={h.id}
                              className="flex items-center gap-1 truncate rounded bg-rose-500/15 px-1 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-400"
                              title={h.name}
                            >
                              <Palmtree className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{h.name}</span>
                            </span>
                          ))}
                          {ls.slice(0, hs.length > 0 ? 1 : 2).map((l) => (
                            <span
                              key={l.id}
                              className={cn(
                                "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium",
                                l.status === "APPROVED"
                                  ? "bg-emerald-500/15"
                                  : "bg-amber-500/15",
                                leaveText(l.status)
                              )}
                              title={`${l.leaveTypeName} (${l.status})`}
                            >
                              <Plane className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{l.leaveTypeName}</span>
                            </span>
                          ))}
                          {hs.length + ls.length > 2 && (
                            <span className="px-1 text-[9px] text-muted-foreground">
                              +{hs.length + ls.length - 2} more
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Side column */}
        <div className="flex flex-col gap-6">
          {/* Selected day */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {dayjs(selected).format("dddd, DD MMMM YYYY")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {selHolidays.length === 0 && selLeaves.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nothing scheduled on this day.
                </p>
              ) : (
                <>
                  {selHolidays.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 rounded-lg border p-2.5">
                      <Palmtree className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                      <div>
                        <div className="text-sm font-medium">{h.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Public holiday{h.state ? ` · ${h.state}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                  {selLeaves.map((l) => (
                    <div key={l.id} className="flex items-start gap-2 rounded-lg border p-2.5">
                      <Plane className={cn("mt-0.5 h-4 w-4 shrink-0", leaveText(l.status))} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{l.leaveTypeName}</span>
                          <Badge
                            variant={l.status === "APPROVED" ? "success" : "warning"}
                            className="text-[9px]"
                          >
                            {l.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {dayjs(l.fromDate).format("DD MMM")} – {dayjs(l.toDate).format("DD MMM")}
                        </div>
                        {l.reason && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {l.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardContent className="flex flex-wrap gap-x-4 gap-y-2 p-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Holiday
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Approved leave
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pending leave
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[7px] text-primary-foreground">
                  1
                </span>{" "}
                Today
              </span>
            </CardContent>
          </Card>

          {/* Upcoming */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarCheck className="h-4 w-4 text-primary" /> Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingHolidays.length === 0 && upcomingLeaves.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  No upcoming holidays or leaves.
                </p>
              ) : (
                <>
                  {upcomingHolidays.map((h) => (
                    <button
                      key={`h-${h.id}`}
                      onClick={() => {
                        setCursor(dayjs(h.holidayDate).startOf("month"));
                        setSelected(dayjs(h.holidayDate).format(FMT));
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted/60"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                      <span className="flex-1 truncate text-xs font-medium">{h.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {dayjs(h.holidayDate).format("DD MMM")}
                      </span>
                    </button>
                  ))}
                  {upcomingLeaves.map((l) => (
                    <button
                      key={`l-${l.id}`}
                      onClick={() => {
                        setCursor(dayjs(l.fromDate).startOf("month"));
                        setSelected(dayjs(l.fromDate).format(FMT));
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted/60"
                    >
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", leaveDot(l.status))} />
                      <span className="flex-1 truncate text-xs font-medium">{l.leaveTypeName}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {dayjs(l.fromDate).format("DD MMM")}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
