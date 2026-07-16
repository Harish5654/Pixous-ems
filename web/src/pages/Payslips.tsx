import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Wallet, FileText, Plus, Send, Clock } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { formatMoney, monthName } from "@/lib/utils";
import type { ApiEnvelope, PayslipSummary, PayslipRequest } from "@/types";

const MONTHS = Array.from({ length: 12 }).map((_, i) => i + 1);
const now = new Date();
const YEARS = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

const schema = z.object({
  month: z.string().min(1, "Choose a month"),
  year: z.string().min(1, "Choose a year"),
  note: z.string().optional()
});
type FormValues = z.infer<typeof schema>;

export default function PayslipsPage() {
  const qc = useQueryClient();
  const [downloading, setDownloading] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const payslips = useQuery({
    queryKey: ["payslips"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<PayslipSummary[]>>("/payroll/payslip/list")).data.data
  });

  const requests = useQuery({
    queryKey: ["payslip-requests", "me"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<PayslipRequest[]>>("/payroll/requests/me")).data.data
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { month: String(now.getMonth() + 1), year: String(now.getFullYear()) }
  });

  const raise = useMutation({
    mutationFn: async (v: FormValues) =>
      api.post("/payroll/requests", {
        month: Number(v.month),
        year: Number(v.year),
        note: v.note || undefined
      }),
    onSuccess: () => {
      toast.success("Payslip request sent to admin");
      qc.invalidateQueries({ queryKey: ["payslip-requests"] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(apiMessage(err, "Could not send request"))
  });

  async function download(id: number, label: string) {
    setDownloading(id);
    try {
      const res = await api.get(`/payroll/payslip/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${label}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(apiMessage(err, "Could not download payslip"));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Payslips"
        subtitle="Request a payslip from admin, then download it here once approved."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Request payslip
          </Button>
        }
      />

      {/* Available payslips (download) */}
      {payslips.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (payslips.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No payslips yet"
          description="Request a payslip for a month. Once admin approves it, it appears here to download."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {payslips.data!.map((p) => {
            const label = `${monthName(p.payMonth)}-${p.payYear}`;
            return (
              <Card key={p.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-display text-lg font-semibold">
                        {monthName(p.payMonth)} {p.payYear}
                      </div>
                      <div className="text-xs text-muted-foreground">Net pay</div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                  </div>

                  <div className="mt-3 font-display text-2xl font-bold text-primary">
                    {formatMoney(p.netPay)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Gross {formatMoney(p.grossSalary)}
                  </div>

                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    disabled={downloading === p.id}
                    onClick={() => download(p.id, label)}
                  >
                    {downloading === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download PDF
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* My requests */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>My payslip requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.isLoading ? (
            <Skeleton className="h-32" />
          ) : (requests.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Send}
              title="No requests yet"
              description="Use “Request payslip” to ask admin to generate a month's payslip for you."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.data!.map((r) => {
                  const label = `${monthName(r.payMonth)}-${r.payYear}`;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {monthName(r.payMonth)} {r.payYear}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {dayjs(r.createdAt).format("DD MMM YYYY")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                        {r.status === "REJECTED" && r.decisionNote && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {r.decisionNote}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "APPROVED" && r.payslipId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={downloading === r.payslipId}
                            onClick={() => download(r.payslipId!, label)}
                          >
                            {downloading === r.payslipId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            Download
                          </Button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" /> Awaiting admin
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Request dialog */}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogHeader
          title="Request a payslip"
          description="Your request goes to admin. Once approved, download it from this page."
        />
        <form onSubmit={handleSubmit((v) => raise.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="month">Month</Label>
              <Select id="month" {...register("month")}>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </Select>
              {errors.month && <p className="text-xs text-destructive">{errors.month.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="year">Year</Label>
              <Select id="year" {...register("year")}>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
              {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" rows={3} placeholder="Anything admin should know…" {...register("note")} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={raise.isPending}>
              {raise.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send request
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
