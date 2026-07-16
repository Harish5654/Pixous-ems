import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Clock, AlertTriangle, MapPin, ScanFace, Smartphone, Monitor, FileSpreadsheet } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import dayjs from "dayjs";
import type { ApiEnvelope, AttendanceRecord, UserSummary } from "@/types";
import toast from "react-hot-toast";

function LocationDisplay({ lat, lng }: { lat: number; lng: number }) {
  const [address, setAddress] = useState<string>("Loading location...");

  useEffect(() => {
    async function fetchAddress() {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        if (data && data.display_name) {
          // Extract a shorter version of the address (e.g. neighborhood, city, state)
          const parts = data.display_name.split(", ");
          setAddress(parts.slice(0, 3).join(", "));
        } else {
          setAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      } catch (e) {
        setAddress("Location available");
      }
    }
    fetchAddress();
  }, [lat, lng]);

  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 text-primary hover:underline font-medium text-xs line-clamp-1"
      title="View on Maps"
    >
      <MapPin className="h-3.5 w-3.5 shrink-0" /> {address}
    </a>
  );
}

export default function TeamAttendancePage() {
  const [date, setDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [search, setSearch] = useState("");

  const teamMembers = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get<ApiEnvelope<{ content: UserSummary[] }>>("/users?size=1000")).data.data.content
  });

  const teamAttendance = useQuery({
    queryKey: ["team-attendance", date],
    queryFn: async () => (await api.get<ApiEnvelope<AttendanceRecord[]>>(`/attendance/team?date=${date}`)).data.data
  });

  const getUserName = (userId: number) => {
    return teamMembers.data?.find(u => u.id === userId)?.name || `User ${userId}`;
  };

  const getStatusColor = (status: string, late: boolean) => {
    if (late) return "text-orange-600 border-orange-600 bg-orange-50";
    switch (status) {
      case "PRESENT": return "text-green-600 border-green-600 bg-green-50";
      case "ABSENT": return "text-red-600 border-red-600 bg-red-50";
      case "WFH": return "text-purple-600 border-purple-600 bg-purple-50";
      case "HALF_DAY": return "text-yellow-600 border-yellow-600 bg-yellow-50";
      default: return "text-slate-600 border-slate-600 bg-slate-50";
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "--:--";
    return dayjs(iso).format("h:mm A");
  };

  const isLoading = teamAttendance.isLoading || teamMembers.isLoading;

  const filtered = (teamAttendance.data ?? []).filter((att) => {
    if (!search.trim()) return true;
    return getUserName(att.userId).toLowerCase().includes(search.trim().toLowerCase());
  });

  // Helper to generate all dates for the currently selected month
  const getDaysInMonth = (dateStr: string) => {
    const d = dayjs(dateStr);
    const year = d.year();
    const month = d.month(); // 0-indexed
    const numDays = d.daysInMonth();

    const dates: string[] = [];
    for (let i = 1; i <= numDays; i++) {
      const dateVal = dayjs(new Date(year, month, i)).format("YYYY-MM-DD");
      dates.push(dateVal);
    }
    return dates;
  };

  // Client-side monthly overall Excel export function
  const exportToExcel = async () => {
    const toastId = toast.loading("Fetching overall month attendance data...");
    try {
      const dates = getDaysInMonth(date);
      const results = await Promise.all(
        dates.map(async (d) => {
          const res = await api.get<ApiEnvelope<AttendanceRecord[]>>(`/attendance/team?date=${d}`);
          return { dateStr: d, records: res.data.data || [] };
        })
      );

      const headers = [
        "Employee Name",
        "Date",
        "Status",
        "Punch In",
        "Punch Out",
        "Punch In GPS",
        "Punch Out GPS",
        "Punch In Map Link",
        "Punch Out Map Link",
        "Mode",
        "Is Late",
        "Geofence Exception"
      ];

      const rows: string[][] = [];

      results.forEach(day => {
        day.records.forEach(att => {
          // If search text is active, filter rows matching user search
          const empName = getUserName(att.userId);
          if (search.trim() && !empName.toLowerCase().includes(search.trim().toLowerCase())) {
            return;
          }

          const inGPS = att.inLatitude && att.inLongitude ? `${att.inLatitude}, ${att.inLongitude}` : "N/A";
          const outGPS = att.outLatitude && att.outLongitude ? `${att.outLatitude}, ${att.outLongitude}` : "N/A";
          const inMap = att.inLatitude && att.inLongitude ? `https://www.google.com/maps/search/?api=1&query=${att.inLatitude},${att.inLongitude}` : "N/A";
          const outMap = att.outLatitude && att.outLongitude ? `https://www.google.com/maps/search/?api=1&query=${att.outLatitude},${att.outLongitude}` : "N/A";

          const formattedDate = dayjs(day.dateStr).format("DD MMM YYYY");

          rows.push([
            `"${empName.replace(/"/g, '""')}"`,
            `"${formattedDate}"`,
            `"${att.late ? "LATE" : att.status}"`,
            `"${formatTime(att.punchInAt)}"`,
            `"${formatTime(att.punchOutAt)}"`,
            `"${inGPS}"`,
            `"${outGPS}"`,
            `"${inMap}"`,
            `"${outMap}"`,
            `"${att.mode || 'N/A'}"`,
            `"${att.late ? "Yes" : "No"}"`,
            `"${att.geofenceException ? "Yes" : "No"}"`
          ]);
        });
      });

      if (rows.length === 0) {
        toast.error("No attendance records found for this month.", { id: toastId });
        return;
      }

      // Sort rows by Date then Employee Name
      rows.sort((a, b) => {
        if (a[1] !== b[1]) return a[1].localeCompare(b[1]);
        return a[0].localeCompare(b[0]);
      });

      const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const monthLabel = dayjs(date).format("YYYY_MM");
      link.setAttribute("href", url);
      link.setAttribute("download", `Monthly_Team_Attendance_${monthLabel}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Monthly Excel exported successfully!", { id: toastId });
    } catch (err) {
      console.error("Failed to export monthly attendance:", err);
      toast.error("Failed to fetch monthly attendance data.", { id: toastId });
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <PageHeader title="Employee Attendance" subtitle="View today's attendance for your direct reports." />

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search employee…"
            className="px-3 py-2 border rounded-md text-sm bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            type="date"
            className="px-3 py-2 border rounded-md text-sm bg-background"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-semibold transition-colors shadow-sm"
            title="Export Month to Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Export Month</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team attendance"
          description={`No attendance records found for ${dayjs(date).format("MMM D, YYYY")}.`}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((att) => (
            <Card key={att.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="font-display text-lg font-semibold truncate">
                    {getUserName(att.userId)}
                  </div>
                  <Badge variant="outline" className={getStatusColor(att.status, att.late)}>
                    {att.late ? "Late" : att.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase">In</span>
                      <span className="font-medium text-foreground">{formatTime(att.punchInAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase">Out</span>
                      <span className="font-medium text-foreground">{formatTime(att.punchOutAt)}</span>
                    </div>
                  </div>
                </div>

                {att.status === "PRESENT" && (
                  <div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground border-t pt-3">
                    <div className="flex items-center gap-2">
                      {att.mode === "APP" ? (
                        <Smartphone className="h-3.5 w-3.5 text-blue-500" />
                      ) : att.mode === "FACE_VERIFIED" ? (
                        <ScanFace className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Monitor className="h-3.5 w-3.5 text-slate-500" />
                      )}
                      <span className={att.mode === "FACE_VERIFIED" ? "text-green-700 font-medium" : ""}>
                        {att.mode === "APP" ? "Mobile App (GPS)" : att.mode === "FACE_VERIFIED" ? "Face Authenticated" : "Standard Web Punch"}
                      </span>
                      {att.geofenceException && (
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 ml-auto" />
                      )}
                    </div>
                    {att.inLatitude && att.inLongitude && (
                      <LocationDisplay lat={att.inLatitude} lng={att.inLongitude} />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
