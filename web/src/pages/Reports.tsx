import { useState } from "react";
import { Download, FileBarChart, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";

export default function ReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  
  // States for attendance/leave report
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  
  // States for payroll report
  const [payMonth, setPayMonth] = useState(new Date().getMonth() + 1);
  const [payYear, setPayYear] = useState(new Date().getFullYear());

  const downloadReport = async (type: string) => {
    setDownloading(type);
    try {
      let url = "";
      let filename = "";
      if (type === "attendance") {
        url = `/reports/attendance?from=${fromDate}&to=${toDate}`;
        filename = `attendance_report_${fromDate}_${toDate}.xlsx`;
      } else if (type === "leave") {
        url = `/reports/leave?from=${fromDate}&to=${toDate}`;
        filename = `leave_report_${fromDate}_${toDate}.xlsx`;
      } else if (type === "payroll") {
        url = `/reports/payroll?month=${payMonth}&year=${payYear}`;
        filename = `payroll_report_${payMonth}_${payYear}.xlsx`;
      }

      const res = await api.get(url, { responseType: "blob" });
      const blobUrl = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error(apiMessage(err, "Failed to download report"));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <PageHeader 
        title="Reports & Analytics" 
        subtitle="Generate and download compliance and operational reports." 
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Attendance Report Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FileBarChart className="w-5 h-5 mr-2" />
              Attendance Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">From Date</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">To Date</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
            </div>
            <Button 
              className="w-full"
              disabled={downloading === "attendance"}
              onClick={() => downloadReport("attendance")}
            >
              {downloading === "attendance" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download Excel
            </Button>
          </CardContent>
        </Card>

        {/* Leave Report Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FileBarChart className="w-5 h-5 mr-2" />
              Leave Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">From Date</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">To Date</label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
            </div>
            <Button 
              className="w-full"
              disabled={downloading === "leave"}
              onClick={() => downloadReport("leave")}
            >
              {downloading === "leave" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download Excel
            </Button>
          </CardContent>
        </Card>

        {/* Payroll Report Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FileBarChart className="w-5 h-5 mr-2" />
              Payroll Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Month</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={payMonth}
                  min={1} max={12}
                  onChange={e => setPayMonth(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Year</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={payYear}
                  onChange={e => setPayYear(parseInt(e.target.value))}
                />
              </div>
            </div>
            <Button 
              className="w-full"
              disabled={downloading === "payroll"}
              onClick={() => downloadReport("payroll")}
            >
              {downloading === "payroll" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download Excel
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
