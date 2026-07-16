import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Inbox, Check, X, FileText, Upload } from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, monthName } from "@/lib/utils";
import type { ApiEnvelope, PayslipRequest } from "@/types";

// The customizable payslip form. Every line is editable so the generated
// PDF matches the company's own format (like the Pixous payslip).
interface PayslipForm {
  companyName: string;
  companyGstin: string;
  companyAddress: string;
  companyLogo: string; // storage path returned by the logo upload
  employeeName: string;
  employeeCode: string;
  designation: string;
  department: string;
  bankName: string;
  bankAccount: string;
  payDate: string;
  workingDays: string;
  lopDays: string;
  basicSalary: string;
  hra: string;
  allowances: string;
  overtimePay: string;
  performancePay: string;
  expensesPay: string;
  pfDeduction: string;
  esiDeduction: string;
  ptDeduction: string;
  tdsDeduction: string;
  healthInsurance: string;
  salaryAdvance: string;
  otherDeductions: string;
  decisionNote: string;
}

function emptyForm(r: PayslipRequest): PayslipForm {
  return {
    companyName: "Pixous Technologies Pvt Ltd",
    companyGstin: "",
    companyAddress: "",
    companyLogo: "",
    employeeName: r.employeeName,
    employeeCode: r.employeeCode,
    designation: "",
    department: "",
    bankName: "",
    bankAccount: "",
    payDate: dayjs(`${r.payYear}-${String(r.payMonth).padStart(2, "0")}-01`)
      .endOf("month")
      .format("YYYY-MM-DD"),
    workingDays: "30",
    lopDays: "0",
    basicSalary: "0",
    hra: "0",
    allowances: "0",
    overtimePay: "0",
    performancePay: "0",
    expensesPay: "0",
    pfDeduction: "0",
    esiDeduction: "0",
    ptDeduction: "0",
    tdsDeduction: "0",
    healthInsurance: "0",
    salaryAdvance: "0",
    otherDeductions: "0",
    decisionNote: ""
  };
}

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export default function PayrollRequestsPage() {
  const qc = useQueryClient();
  const [active, setActive] = useState<PayslipRequest | null>(null);
  const [form, setForm] = useState<PayslipForm | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>("");

  const inbox = useQuery({
    queryKey: ["payslip-requests", "inbox"],
    queryFn: async () =>
      (await api.get<ApiEnvelope<PayslipRequest[]>>("/payroll/requests?pendingOnly=true")).data.data
  });

  const approve = useMutation({
    mutationFn: async () => {
      if (!active || !form) return;
      return api.post(`/payroll/requests/${active.id}/approve`, {
        companyName: form.companyName || undefined,
        companyGstin: form.companyGstin || undefined,
        companyAddress: form.companyAddress || undefined,
        companyLogo: form.companyLogo || undefined,
        employeeName: form.employeeName || undefined,
        employeeCode: form.employeeCode || undefined,
        designation: form.designation || undefined,
        department: form.department || undefined,
        bankName: form.bankName || undefined,
        bankAccount: form.bankAccount || undefined,
        payDate: form.payDate || undefined,
        workingDays: form.workingDays ? Number(form.workingDays) : undefined,
        lopDays: num(form.lopDays),
        basicSalary: num(form.basicSalary),
        hra: num(form.hra),
        allowances: num(form.allowances),
        overtimePay: num(form.overtimePay),
        performancePay: num(form.performancePay),
        expensesPay: num(form.expensesPay),
        pfDeduction: num(form.pfDeduction),
        esiDeduction: num(form.esiDeduction),
        ptDeduction: num(form.ptDeduction),
        tdsDeduction: num(form.tdsDeduction),
        healthInsurance: num(form.healthInsurance),
        salaryAdvance: num(form.salaryAdvance),
        otherDeductions: num(form.otherDeductions),
        decisionNote: form.decisionNote || undefined
      });
    },
    onSuccess: () => {
      toast.success("Payslip generated and sent to employee");
      qc.invalidateQueries({ queryKey: ["payslip-requests"] });
      close();
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
    onError: (err) => toast.error(apiMessage(err, "Could not reject"))
  });

  async function onLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<ApiEnvelope<{ path: string }>>("/payroll/requests/logo", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setForm({ ...form, companyLogo: res.data.data.path });
      setLogoPreview(URL.createObjectURL(file));
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(apiMessage(err, "Logo upload failed"));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function openForm(r: PayslipRequest) {
    setActive(r);
    setForm(emptyForm(r));
    setLogoPreview("");

    // Auto-fetch employee's bank accounts
    try {
      const res = await api.get<ApiEnvelope<any[]>>(`/users/${r.userId}/bank`);
      const banks = res.data.data;
      if (banks && banks.length > 0) {
        const primary = banks.find(b => b.primary) || banks[0];
        setForm(f => f ? {
          ...f,
          bankName: primary.bankName || "",
          bankAccount: primary.accountNumber || ""
        } : f);
      }
    } catch (err) {
      // Ignore if no bank accounts found or permission error
    }
  }
  function close() {
    setActive(null);
    setForm(null);
    setLogoPreview("");
  }

  function set<K extends keyof PayslipForm>(k: K, v: string) {
    if (form) setForm({ ...form, [k]: v });
  }

  const totals = useMemo(() => {
    if (!form) return { earnings: 0, deductions: 0, net: 0 };
    const earnings =
      num(form.basicSalary) + num(form.hra) + num(form.allowances) +
      num(form.overtimePay) + num(form.performancePay) + num(form.expensesPay);
    const deductions =
      num(form.pfDeduction) + num(form.esiDeduction) + num(form.ptDeduction) +
      num(form.tdsDeduction) + num(form.healthInsurance) + num(form.salaryAdvance) +
      num(form.otherDeductions);
    return { earnings, deductions, net: earnings - deductions };
  }, [form]);

  const list = inbox.data ?? [];

  const earningFields: [keyof PayslipForm, string][] = [
    ["basicSalary", "Basic Salary"],
    ["hra", "HRA"],
    ["allowances", "Allowances"],
    ["overtimePay", "Overtime"],
    ["performancePay", "Performance Pay"],
    ["expensesPay", "Expenses"]
  ];
  const deductionFields: [keyof PayslipForm, string][] = [
    ["pfDeduction", "PF"],
    ["esiDeduction", "ESI"],
    ["ptDeduction", "Professional Tax"],
    ["tdsDeduction", "TDS"],
    ["healthInsurance", "Health Insurance"],
    ["salaryAdvance", "Salary Advance"],
    ["otherDeductions", "Other"]
  ];

  return (
    <div>
      <PageHeader
        title="Payslip requests"
        subtitle="Approve requests by filling the customizable payslip form, then it's sent to the employee to download."
      />

      {inbox.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No pending requests"
          description="When employees request payslips, they'll appear here for you to generate."
        />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <Avatar name={r.employeeName} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.employeeName}</span>
                    <Badge variant="secondary" className="code-chip">{r.employeeCode}</Badge>
                    <Badge variant="default">
                      {monthName(r.payMonth)} {r.payYear}
                    </Badge>
                  </div>
                  {r.note && (
                    <div className="mt-1 truncate text-sm text-muted-foreground">"{r.note}"</div>
                  )}
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Requested {dayjs(r.createdAt).format("DD MMM YYYY, h:mm A")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reject.isPending}
                    onClick={() => reject.mutate(r)}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                  <Button size="sm" onClick={() => openForm(r)}>
                    <FileText className="h-4 w-4" /> Generate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Generate / customize dialog */}
      <Dialog open={!!active} onClose={close} className="max-w-4xl">
        {active && form && (
          <>
            <DialogHeader
              title={`Generate payslip — ${monthName(active.payMonth)} ${active.payYear}`}
              description="All fields are editable. Add your company name, logo, GST and each salary line; the employee downloads exactly this."
            />
            <div className="grid gap-6 md:grid-cols-2">
              {/* ---- Left: form ---- */}
              <div className="space-y-5">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Company</h3>
                  <div className="space-y-1.5">
                    <Label>Company name</Label>
                    <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>GSTIN</Label>
                      <Input value={form.companyGstin} onChange={(e) => set("companyGstin", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Company logo</Label>
                      <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted">
                        {uploadingLogo ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {form.companyLogo ? "Change" : "Upload"}
                        <input type="file" accept="image/*" className="hidden" onChange={onLogoPick} />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Address</Label>
                    <Input value={form.companyAddress} onChange={(e) => set("companyAddress", e.target.value)} />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Employee</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input value={form.employeeName} onChange={(e) => set("employeeName", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Employee ID</Label>
                      <Input value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Designation</Label>
                      <Input value={form.designation} onChange={(e) => set("designation", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Department</Label>
                      <Input value={form.department} onChange={(e) => set("department", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Bank name</Label>
                      <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Bank A/C</Label>
                      <Input value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Pay date</Label>
                      <Input type="date" value={form.payDate} onChange={(e) => set("payDate", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Working days</Label>
                      <Input type="number" value={form.workingDays} onChange={(e) => set("workingDays", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>LOP days</Label>
                      <Input type="number" value={form.lopDays} onChange={(e) => set("lopDays", e.target.value)} />
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Earnings</h3>
                    {earningFields.map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <Input
                          type="number"
                          value={form[key]}
                          onChange={(e) => set(key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Deductions</h3>
                    {deductionFields.map(([key, label]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <Input
                          type="number"
                          value={form[key]}
                          onChange={(e) => set(key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* ---- Right: live preview ---- */}
              <div className="md:sticky md:top-0 md:self-start">
                <div className="rounded-lg border bg-white p-5 text-slate-800 shadow-sm">
                  <div className="flex items-start justify-between border-b pb-3">
                    <div>
                      <div className="flex items-center gap-3">
                        {logoPreview && (
                          <img src={logoPreview} alt="logo" className="max-h-12 w-auto object-contain" />
                        )}
                        <div className="text-lg font-bold">{form.companyName || "Company"}</div>
                      </div>
                      {form.companyAddress && (
                        <div className="mt-1 text-[11px] text-slate-500">{form.companyAddress}</div>
                      )}
                      {form.companyGstin && (
                        <div className="text-[11px] text-slate-500">GSTIN: {form.companyGstin}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold uppercase tracking-widest text-slate-600">Payslip</div>
                      <div className="text-xs text-slate-500">
                        {monthName(active.payMonth)} {active.payYear}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-3 text-xs">
                    <div><span className="text-slate-400">Employee: </span>{form.employeeName}</div>
                    <div><span className="text-slate-400">ID: </span>{form.employeeCode}</div>
                    {form.designation && <div><span className="text-slate-400">Designation: </span>{form.designation}</div>}
                    {form.department && <div><span className="text-slate-400">Dept: </span>{form.department}</div>}
                    {form.bankName && <div><span className="text-slate-400">Bank: </span>{form.bankName}</div>}
                    {form.bankAccount && <div><span className="text-slate-400">A/C: </span>{form.bankAccount}</div>}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="mb-1 font-semibold">Earnings</div>
                      {earningFields.filter(([k]) => num(form[k]) !== 0 || k === "basicSalary").map(([k, label]) => (
                        <div key={k} className="flex justify-between py-0.5">
                          <span className="text-slate-500">{label}</span>
                          <span>{formatMoney(num(form[k]))}</span>
                        </div>
                      ))}
                      <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
                        <span>Gross</span>
                        <span>{formatMoney(totals.earnings)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 font-semibold">Deductions</div>
                      {deductionFields.filter(([k]) => num(form[k]) !== 0).map(([k, label]) => (
                        <div key={k} className="flex justify-between py-0.5">
                          <span className="text-slate-500">{label}</span>
                          <span>{formatMoney(num(form[k]))}</span>
                        </div>
                      ))}
                      <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
                        <span>Total</span>
                        <span>{formatMoney(totals.deductions)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t-2 border-slate-800 pt-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Net Pay</span>
                    <span className="text-xl font-bold">{formatMoney(totals.net)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
                {approve.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Generate & send
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
