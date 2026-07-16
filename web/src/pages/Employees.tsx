import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  useReactTable, getCoreRowModel, flexRender, createColumnHelper
} from "@tanstack/react-table";
import { Search, Users, ChevronLeft, ChevronRight, UserPlus, Loader2, Camera, RefreshCw, Download, FileSpreadsheet, UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, resolvePhotoUrl } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import type { ApiEnvelope, PageEnvelope, UserSummary, Profile, DropdownItem } from "@/types";
import { parseEmployeeWorkbook, credsToCsv, type EmployeeImportPayload, type ImportCred } from "@/lib/employeeImport";
import dayjs from "dayjs";
import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

const column = createColumnHelper<UserSummary>();

export default function EmployeesPage() {
  const { hasPermission } = useAuth();
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [addIndustry, setAddIndustry] = useState<"IT" | "CIVIL" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const canManage = hasPermission("USER_MANAGE");

  const directory = useQuery({
    queryKey: ["employees", q, industry, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: "10" });
      if (q) params.set("q", q);
      if (industry) params.set("industry", industry);
      const res = await api.get<ApiEnvelope<PageEnvelope<UserSummary>>>(
        `/users?${params.toString()}`
      );
      return res.data.data;
    }
  });

  const columns = useMemo(
    () => [
      column.accessor("name", {
        header: "Employee",
        cell: (info) => (
          <div className="flex items-center gap-3">
            <Avatar name={info.getValue()} src={info.row.original.photoPath} />
            <div>
              <div className="font-medium">{info.getValue()}</div>
              <div className="code-chip text-xs text-muted-foreground">
                {info.row.original.employeeCode}
              </div>
            </div>
          </div>
        )
      }),
      column.accessor("email", {
        header: "Contact",
        cell: (info) => (
          <div className="text-sm">
            <div>{info.getValue() || "—"}</div>
            <div className="text-muted-foreground">{info.row.original.phone || ""}</div>
          </div>
        )
      }),
      column.accessor("industry", {
        header: "Industry",
        cell: (info) => {
          const raw = info.getValue();
          const label = raw === "IT" ? "DIGITAL" : raw === "CIVIL" ? "INFRA" : raw || "—";
          const variant = raw === "IT" ? "sky" : raw === "CIVIL" ? "warning" : "secondary";
          return (
            <Badge
              variant={variant as any}
              className={
                raw === "IT"
                  ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-0"
                  : raw === "CIVIL"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0"
                  : ""
              }
            >
              {label}
            </Badge>
          );
        }
      }),
      column.accessor("roles", {
        header: "Roles",
        cell: (info) => (
          <div className="flex flex-wrap gap-1">
            {(info.getValue() ?? []).slice(0, 2).map((r) => (
              <Badge key={r} className="code-chip text-[10px]">
                {r}
              </Badge>
            ))}
          </div>
        )
      }),
      column.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setDetailId(info.row.original.id)}>
              View
            </Button>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => setEditId(info.row.original.id)}
              >
                Edit
              </Button>
            )}
          </div>
        )
      })
    ],
    [canManage]
  );

  const rows = directory.data?.content ?? [];
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  const totalPages = directory.data?.totalPages ?? 1;

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Company directory across IT and field teams."
        actions={
          <div className="flex items-center gap-3">
            {/* Industry Toggle */}
            <div className="flex gap-1.5 bg-muted/60 p-1 rounded-full border">
              <button
                type="button"
                onClick={() => {
                  setIndustry("");
                  setPage(0);
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                  industry === "" 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setIndustry("IT");
                  setPage(0);
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                  industry === "IT" 
                    ? "bg-sky-500 text-white shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                Digital
              </button>
              <button
                type="button"
                onClick={() => {
                  setIndustry("CIVIL");
                  setPage(0);
                }}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                  industry === "CIVIL" 
                    ? "bg-amber-500 text-white shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                Infra
              </button>
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(true)}
                  className="rounded-md"
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Import Excel
                </Button>
                <Button
                  onClick={() => setAddIndustry("IT")}
                  className="bg-sky-600 hover:bg-sky-700 text-white rounded-md shadow"
                >
                  <UserPlus className="mr-1.5 h-4 w-4" /> Add Digital
                </Button>
                <Button
                  onClick={() => setAddIndustry("CIVIL")}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-md shadow"
                >
                  <UserPlus className="mr-1.5 h-4 w-4" /> Add Infra
                </Button>
              </div>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, code or email…"
                className="pl-9"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          </div>

          {directory.isLoading ? (
            <Skeleton className="h-64" />
          ) : rows.length === 0 ? (
            <EmptyState icon={Users} title="No employees found" description="Try a different search." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((h) => (
                        <TableHead key={h.id}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {directory.data?.totalElements ?? 0} employees
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <EmployeeDetail id={detailId} onClose={() => setDetailId(null)} />
      {addIndustry && (
        <AddEmployeeDialog
          onClose={() => setAddIndustry(null)}
          defaultIndustry={addIndustry}
        />
      )}
      {importOpen && <ImportEmployeesDialog onClose={() => setImportOpen(false)} />}
      {editId && (
        <EditEmployeeDialog
          id={editId}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  );
}

function ImportEmployeesDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [payloads, setPayloads] = useState<EmployeeImportPayload[]>([]);
  const [creds, setCreds] = useState<ImportCred[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ created: number; failed: number; fails: { name: string; error: string }[] } | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null); setResults(null); setPayloads([]); setCreds([]);
    setFileName(file.name); setParsing(true);
    try {
      const { payloads, creds } = await parseEmployeeWorkbook(file);
      if (payloads.length === 0) {
        setError("No employees found. Make sure the sheet has an 'Employee List' tab with Emp Id + Name columns.");
      }
      setPayloads(payloads); setCreds(creds);
    } catch (err: any) {
      setError("Could not read the file. Please upload a valid .xlsx workbook.");
    } finally {
      setParsing(false);
    }
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiEnvelope<{ username: string; name: string; created: boolean; error: string | null }[]>>(
        "/auth/employees/bulk",
        payloads
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      const created = data.filter((d) => d.created).length;
      const fails = data.filter((d) => !d.created).map((d) => ({ name: d.name, error: d.error || "failed" }));
      setResults({ created, failed: fails.length, fails });
      qc.invalidateQueries({ queryKey: ["employees"] });
      if (created > 0) toast.success(`${created} employee(s) imported`);
    },
    onError: (err) => setError(apiMessage(err, "Import failed"))
  });

  function downloadCreds() {
    const url = URL.createObjectURL(credsToCsv(creds));
    const a = document.createElement("a");
    a.href = url;
    a.download = "Employee_Login_Credentials.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const activeCount = payloads.filter((p) => p.profileStatus === "ACTIVE").length;

  return (
    <Dialog open onClose={onClose} className="max-w-lg">
      <DialogHeader
        title="Import employees from Excel"
        description="Upload the company employee sheet (.xlsx). Each employee gets a login (username = Emp ID, password = Firstname@123)."
      />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onPick} />

      {!results ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            {parsing ? <Loader2 className="h-7 w-7 animate-spin" /> : <UploadCloud className="h-7 w-7" />}
            <span className="text-sm font-medium">{fileName || "Click to choose an .xlsx file"}</span>
          </button>

          {payloads.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {payloads.length} employees found
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {activeCount} active · {payloads.length - activeCount} offboarded. Duplicate/blank phone &amp; Aadhaar are auto-handled.
              </div>
              <div className="mt-2 max-h-32 overflow-y-auto text-xs">
                {payloads.slice(0, 8).map((p) => (
                  <div key={p.username} className="flex justify-between border-b py-0.5 last:border-0">
                    <span className="truncate">{p.name}</span>
                    <span className="code-chip text-muted-foreground">{p.username}</span>
                  </div>
                ))}
                {payloads.length > 8 && <div className="pt-1 text-muted-foreground">+{payloads.length - 8} more…</div>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={payloads.length === 0 || importMutation.isPending}
            >
              {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Import {payloads.length || ""} employees
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-lg font-bold">
              <CheckCircle2 className="h-5 w-5 text-success" /> {results.created} imported
            </div>
            {results.failed > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" /> {results.failed} skipped (already exists / invalid)
                </div>
                <div className="mt-1 max-h-28 overflow-y-auto text-xs text-muted-foreground">
                  {results.fails.map((f, i) => (
                    <div key={i}>{f.name} — {f.error}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Download the credentials list to share usernames &amp; passwords with employees.
          </p>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={downloadCreds}>
              <Download className="mr-1.5 h-4 w-4" /> Download credentials
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function genderLabel(g?: string): string | undefined {
  if (!g) return undefined;
  const c = g.trim().toUpperCase()[0];
  return c === "M" ? "Male" : c === "F" ? "Female" : c === "O" ? "Other" : g;
}

function industryLabel(i?: string): string | undefined {
  return i === "IT" ? "DIGITAL" : i === "CIVIL" ? "INFRA" : i;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function EmployeeDetail({ id, onClose }: { id: number | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [showOffboard, setShowOffboard] = useState(false);
  const [relievingDate, setRelievingDate] = useState("");
  const [reason, setReason] = useState("");
  const [downloading, setDownloading] = useState(false);

  const detail = useQuery({
    queryKey: ["employee", id],
    enabled: id != null,
    queryFn: async () =>
      (await api.get<ApiEnvelope<Profile>>(`/users/${id}`)).data.data
  });

  const orgLookups = useQuery({
    queryKey: ["org-dropdowns", "employee-detail"],
    enabled: id != null,
    queryFn: async () => {
      const res = await api.post<ApiEnvelope<Record<string, DropdownItem[]>>>(
        "/org/dropdowns",
        ["department", "designation", "office_location"]
      );
      return res.data.data;
    }
  });

  const labelFor = (items: DropdownItem[] | undefined, key?: number) =>
    key == null ? undefined : items?.find((i) => i.id === key)?.label;

  const offboardMutation = useMutation({
    mutationFn: async (data: { relievingDate: string; reason: string }) => {
      await api.post(`/users/${id}/offboarding`, data);
    },
    onSuccess: () => {
      toast.success("Employee offboarded successfully");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setShowOffboard(false);
      setRelievingDate("");
      setReason("");
    },
    onError: (err) => toast.error(apiMessage(err, "Could not offboard employee"))
  });

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      toast.success("Employee deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      onClose();
      setShowConfirmDelete(false);
    },
    onError: (err) => toast.error(apiMessage(err, "Could not delete employee"))
  });

  const p = detail.data;

  const deptName = labelFor(orgLookups.data?.department, p?.departmentId);
  const desigName = labelFor(orgLookups.data?.designation, p?.designationId);
  const officeName = labelFor(orgLookups.data?.office_location, p?.officeLocationId);
  const addressStr = p?.address
    ? [p.address.house, p.address.street, p.address.locality, p.address.district, p.address.state, p.address.pincode]
        .filter(Boolean)
        .join(", ")
    : "";

  async function downloadProfile() {
    if (!p) return;
    setDownloading(true);
    try {
      // Embed the photo as base64 so the document is self-contained.
      let photoHtml = "";
      if (p.photoPath) {
        try {
          const url = resolvePhotoUrl(p.photoPath);
          const blob = await (await fetch(url!)).blob();
          const dataUrl: string = await new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onloadend = () => res(fr.result as string);
            fr.onerror = rej;
            fr.readAsDataURL(blob);
          });
          photoHtml = `<img src="${dataUrl}" width="132" height="132" style="object-fit:cover;border-radius:10px;" />`;
        } catch {
          /* no photo — skip */
        }
      }

      const rows: [string, string | undefined][] = [
        ["Employee Code", p.employeeCode],
        ["Full Name", p.name],
        ["Email", p.email],
        ["Personal Email", p.personalEmail],
        ["Phone", p.phone],
        ["Alternate Phone", p.alternatePhone],
        ["Aadhaar Number", p.aadhar],
        ["PAN", p.pan],
        ["Gender", genderLabel(p.gender)],
        ["Date of Birth", p.dob ? dayjs(p.dob).format("DD MMM YYYY") : undefined],
        ["Blood Group", p.bloodGroup],
        ["Industry", industryLabel(p.industry)],
        ["Designation", p.designationTitle || desigName],
        ["Department", p.departmentTitle || deptName],
        ["Position", p.positionTitle],
        ["Office Location", officeName],
        ["Employment Type", p.employmentType],
        ["Date of Joining", p.dateOfJoining ? dayjs(p.dateOfJoining).format("DD MMM YYYY") : undefined],
        ["Emergency Contact", p.emergencyContact ? `${p.emergencyContact}${p.emergencyContactRelation ? ` (${p.emergencyContactRelation})` : ""}` : undefined],
        ["Status", p.profileStatus],
        ["Roles", p.roles?.join(", ")],
        ["Address", addressStr]
      ];

      const tableRows = rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 12px;border:1px solid #d9d9d9;background:#f5f6fa;font-weight:bold;width:34%;">${escapeHtml(
              k
            )}</td><td style="padding:6px 12px;border:1px solid #d9d9d9;">${escapeHtml(v || "—")}</td></tr>`
        )
        .join("");

      const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${escapeHtml(p.name)} - Profile</title></head>
<body style="font-family:Calibri,Arial,sans-serif;color:#1f2937;">
  <div style="text-align:center;margin-bottom:6px;">${photoHtml}</div>
  <h1 style="text-align:center;margin:6px 0 0;font-size:22px;">${escapeHtml(p.name)}</h1>
  <p style="text-align:center;color:#6b7280;margin:2px 0 18px;">${escapeHtml(p.employeeCode)} &middot; Pixous Technologies</p>
  <table style="border-collapse:collapse;width:100%;font-size:13px;">${tableRows}</table>
  <p style="margin-top:22px;color:#9ca3af;font-size:11px;">Generated on ${dayjs().format("DD MMM YYYY, h:mm A")}</p>
</body></html>`;

      const blob = new Blob(["﻿", html], { type: "application/msword" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${p.employeeCode}_${p.name.replace(/\s+/g, "_")}_Profile.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
      toast.success("Profile downloaded");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog className="max-w-2xl" open={id != null} onClose={() => { onClose(); setShowOffboard(false); setShowConfirmDelete(false); }}>
      {detail.isLoading || !p ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <div className="mb-5 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
            <Avatar name={p.name} src={p.photoPath} className="h-28 w-28 text-4xl ring-2 ring-primary/20" />
            <div>
              <h2 className="font-display text-2xl font-bold">{p.name}</h2>
              <div className="code-chip text-sm text-muted-foreground">{p.employeeCode}</div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                <Badge
                  variant={p.profileStatus === "OFFBOARDED" ? "destructive" : "success"}
                >
                  {p.profileStatus || "ACTIVE"}
                </Badge>
                {p.roles?.map((r) => (
                  <Badge key={r} className="code-chip">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Field label="Email" value={p.email} />
            <Field label="Phone" value={p.phone} />
            <Field label="Aadhaar Number" value={p.aadhar} mono />
            <Field label="PAN" value={p.pan} mono />
            <Field label="Gender" value={genderLabel(p.gender)} />
            <Field label="Date of Birth" value={p.dob ? dayjs(p.dob).format("DD MMM YYYY") : undefined} />
            <Field label="Blood Group" value={p.bloodGroup} />
            <Field label="Industry" value={industryLabel(p.industry)} />
            <Field label="Designation" value={p.designationTitle || desigName} />
            <Field label="Department" value={p.departmentTitle || deptName} />
            <Field label="Position" value={p.positionTitle} />
            <Field label="Office Location" value={officeName} />
            <Field label="Employment" value={p.employmentType} />
            <Field
              label="Joined"
              value={p.dateOfJoining ? dayjs(p.dateOfJoining).format("DD MMM YYYY") : undefined}
            />
            <Field label="Alternate Phone" value={p.alternatePhone} />
            <Field label="Personal Email" value={p.personalEmail} />
            <Field
              label="Emergency Contact"
              value={p.emergencyContact ? `${p.emergencyContact}${p.emergencyContactRelation ? ` (${p.emergencyContactRelation})` : ""}` : undefined}
            />
          </div>

          <div className="mt-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Address
            </div>
            <p className="text-sm">{addressStr || "—"}</p>
          </div>

          {p.profileStatus !== "OFFBOARDED" ? (
            <div className="mt-6 border-t pt-4">
              {!showOffboard ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={downloadProfile} disabled={downloading}>
                    {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                    Download Profile
                  </Button>
                  <Button variant="destructive" onClick={() => setShowOffboard(true)}>
                    Offboard Employee
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-destructive">Offboard Employee</h3>
                  <div className="grid gap-2 text-sm">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Relieving Date</label>
                      <Input type="date" value={relievingDate} onChange={e => setRelievingDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Reason</label>
                      <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Resigned, Terminated" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => offboardMutation.mutate({ relievingDate, reason })}
                      disabled={!relievingDate || offboardMutation.isPending}
                    >
                      {offboardMutation.isPending ? "Processing..." : "Confirm Offboarding"}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowOffboard(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 border-t pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="destructive">OFFBOARDED</Badge>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={downloadProfile} disabled={downloading}>
                    {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                    Download Profile
                  </Button>
                  {!showConfirmDelete && (
                    <Button variant="destructive" size="sm" onClick={() => setShowConfirmDelete(true)}>
                      Delete Account
                    </Button>
                  )}
                </div>
              </div>

              {showConfirmDelete && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-destructive">Confirm Permanent Deletion</h4>
                  <p className="text-xs text-muted-foreground leading-normal">
                    Warning: Deleting this account will permanently remove the employee profile and all associated data (attendance, payroll, etc.). This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Permanently"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}

function Field({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-medium code-chip" : "font-medium"}>{value || "—"}</div>
    </div>
  );
}

const ROLE_OPTIONS = [
  { code: "IT_EMP", label: "IT Employee" },
  { code: "IT_MGR", label: "IT Manager / Team Lead" },
  { code: "IT_HR", label: "IT HR / Payroll" },
  { code: "IT_FIN", label: "Finance Officer" },
  { code: "IT_AST", label: "IT Asset Manager" },
  { code: "CV_EMP", label: "Civil Site Employee" },
  { code: "CV_SUP", label: "Civil Supervisor" },
  { code: "CV_HR", label: "Civil HR Manager" },
  { code: "CV_ADM", label: "Civil / Facilities Admin" },
  { code: "CV_AST", label: "Civil Asset Manager" }
];

interface NewEmployeeForm {
  username: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  aadhar: string;
  gender: string;
  dob: string;
  industry: string;
  roleCode: string;
  departmentId: string;
  designationId: string;
  officeLocationId: string;
  dateOfJoining: string;
  house: string;
  street: string;
  district: string;
  state: string;
  pincode: string;
  // extra detail (Excel-style)
  designationTitle: string;
  departmentTitle: string;
  positionTitle: string;
  bloodGroup: string;
  pan: string;
  alternatePhone: string;
  personalEmail: string;
  emergencyContact: string;
  emergencyContactRelation: string;
}

const EMPTY_FORM: NewEmployeeForm = {
  username: "",
  password: "",
  name: "",
  email: "",
  phone: "",
  aadhar: "",
  gender: "",
  dob: "",
  industry: "IT",
  roleCode: "IT_EMP",
  departmentId: "",
  designationId: "",
  officeLocationId: "",
  dateOfJoining: "",
  house: "",
  street: "",
  district: "",
  state: "",
  pincode: "",
  designationTitle: "",
  departmentTitle: "",
  positionTitle: "",
  bloodGroup: "",
  pan: "",
  alternatePhone: "",
  personalEmail: "",
  emergencyContact: "",
  emergencyContactRelation: ""
};

function AddEmployeeDialog({ onClose, defaultIndustry }: { onClose: () => void; defaultIndustry: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NewEmployeeForm>(() => ({
    ...EMPTY_FORM,
    industry: defaultIndustry === "CIVIL" ? "CIVIL" : "IT",
    roleCode: defaultIndustry === "CIVIL" ? "CV_EMP" : "IT_EMP"
  }));
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof NewEmployeeForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const dropdowns = useQuery({
    queryKey: ["org-dropdowns", "employee-form", form.industry],
    queryFn: async () => {
      const res = await api.post<ApiEnvelope<Record<string, DropdownItem[]>>>(
        `/org/dropdowns?industry=${encodeURIComponent(form.industry)}`,
        ["department", "designation", "office_location"]
      );
      return res.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (payload: NewEmployeeForm) => {
      const body = {
        username: payload.username.trim(),
        password: payload.password,
        name: payload.name.trim(),
        email: payload.email.trim() || undefined,
        phone: payload.phone.trim() || undefined,
        aadhar: payload.aadhar.trim() || undefined,
        gender: payload.gender || undefined,
        dob: payload.dob || undefined,
        industry: payload.industry,
        roleCode: payload.roleCode,
        dateOfJoining: payload.dateOfJoining || undefined,
        departmentId: payload.departmentId ? Number(payload.departmentId) : undefined,
        designationId: payload.designationId ? Number(payload.designationId) : undefined,
        officeLocationId: payload.officeLocationId ? Number(payload.officeLocationId) : undefined,
        house: payload.house.trim() || undefined,
        street: payload.street.trim() || undefined,
        district: payload.district.trim() || undefined,
        state: payload.state.trim() || undefined,
        pincode: payload.pincode.trim() || undefined,
        designationTitle: payload.designationTitle.trim() || undefined,
        departmentTitle: payload.departmentTitle.trim() || undefined,
        positionTitle: payload.positionTitle.trim() || undefined,
        bloodGroup: payload.bloodGroup.trim() || undefined,
        pan: payload.pan.trim().toUpperCase() || undefined,
        alternatePhone: payload.alternatePhone.trim() || undefined,
        personalEmail: payload.personalEmail.trim() || undefined,
        emergencyContact: payload.emergencyContact.trim() || undefined,
        emergencyContactRelation: payload.emergencyContactRelation.trim() || undefined
      };
      const res = await api.post<ApiEnvelope<Profile>>("/auth/employees", body);
      return res.data.data;
    },
    onSuccess: async (created) => {
      toast.success(`${created.name} created successfully!`);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      onClose();
    },
    onError: (err) => {
      setError(apiMessage(err, "Could not create employee"));
    }
  });

  function submit() {
    setError(null);
    if (!form.username.trim() || form.username.trim().length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(form.username.trim())) {
      setError("Username may only contain letters, numbers, dot, underscore or hyphen");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (form.aadhar && !/^\d{12}$/.test(form.aadhar)) {
      setError("Aadhaar must be exactly 12 digits (or leave it blank)");
      return;
    }
    if (form.phone && !/^\d{10,15}$/.test(form.phone)) {
      setError("Phone must be 10–15 digits (or leave it blank)");
      return;
    }
    createMutation.mutate(form);
  }

  const departments = dropdowns.data?.department ?? [];
  const designations = dropdowns.data?.designation ?? [];
  const offices = dropdowns.data?.office_location ?? [];

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader
        title="Add Employee"
        description="Create a login and profile. The employee signs in with the username and password you set here."
      />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Login credentials
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ne-username">Username *</Label>
              <Input id="ne-username" value={form.username} autoComplete="off"
                onChange={(e) => set("username", e.target.value)} placeholder="e.g. arun.k" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-password">Temporary password *</Label>
              <Input id="ne-password" type="text" value={form.password} autoComplete="off"
                onChange={(e) => set("password", e.target.value)} placeholder="min 8 characters" />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Personal details
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ne-name">Full name *</Label>
              <Input id="ne-name" value={form.name}
                onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-email">Email</Label>
              <Input id="ne-email" type="email" value={form.email}
                onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-phone">Phone</Label>
              <Input id="ne-phone" value={form.phone}
                onChange={(e) => set("phone", e.target.value)} placeholder="10-digit mobile" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-aadhar">Aadhaar (optional)</Label>
              <Input id="ne-aadhar" value={form.aadhar} inputMode="numeric" maxLength={12}
                onChange={(e) => set("aadhar", e.target.value)} placeholder="12 digits" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-gender">Gender</Label>
              <Select id="ne-gender" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-dob">Date of birth</Label>
              <Input id="ne-dob" type="date" value={form.dob}
                onChange={(e) => set("dob", e.target.value)} />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Employment
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ne-industry">Industry</Label>
              <Select id="ne-industry" value={form.industry}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm(f => ({
                    ...f,
                    industry: val,
                    roleCode: val === "CIVIL" ? "CV_EMP" : "IT_EMP",
                    designationId: ""
                  }));
                }}>
                <option value="IT">IT</option>
                <option value="CIVIL">Civil</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-role">Role</Label>
              <Select id="ne-role" value={form.roleCode}
                onChange={(e) => set("roleCode", e.target.value)}>
                {ROLE_OPTIONS.filter(r => {
                  if (form.industry === "CIVIL") return r.code.startsWith("CV_");
                  return r.code.startsWith("IT_") || r.code === "SUPER_ADMIN";
                }).map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-dept">Department</Label>
              <Select id="ne-dept" value={form.departmentId}
                onChange={(e) => set("departmentId", e.target.value)}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-desig">Designation</Label>
              <Select id="ne-desig" value={form.designationId}
                onChange={(e) => set("designationId", e.target.value)}>
                <option value="">—</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-office">Office location</Label>
              <Select id="ne-office" value={form.officeLocationId}
                onChange={(e) => set("officeLocationId", e.target.value)}>
                <option value="">—</option>
                {offices.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-doj">Date of joining</Label>
              <Input id="ne-doj" type="date" value={form.dateOfJoining}
                onChange={(e) => set("dateOfJoining", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-position">Position</Label>
              <Input id="ne-position" value={form.positionTitle}
                onChange={(e) => set("positionTitle", e.target.value)} placeholder="e.g. Software Developer" />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Additional details
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ne-blood">Blood group</Label>
              <Input id="ne-blood" value={form.bloodGroup}
                onChange={(e) => set("bloodGroup", e.target.value)} placeholder="e.g. B+" maxLength={5} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-pan">PAN</Label>
              <Input id="ne-pan" className="uppercase" value={form.pan}
                onChange={(e) => set("pan", e.target.value)} placeholder="10-char PAN" maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-alt">Alternate phone</Label>
              <Input id="ne-alt" value={form.alternatePhone}
                onChange={(e) => set("alternatePhone", e.target.value)} placeholder="10-digit mobile" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-pemail">Personal email</Label>
              <Input id="ne-pemail" type="email" value={form.personalEmail}
                onChange={(e) => set("personalEmail", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-emc">Emergency contact</Label>
              <Input id="ne-emc" value={form.emergencyContact}
                onChange={(e) => set("emergencyContact", e.target.value)} placeholder="Name / number" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-emr">Emergency contact relation</Label>
              <Input id="ne-emr" value={form.emergencyContactRelation}
                onChange={(e) => set("emergencyContactRelation", e.target.value)} placeholder="e.g. Father" />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Address (optional)
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ne-house">House / building</Label>
              <Input id="ne-house" value={form.house}
                onChange={(e) => set("house", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-street">Street</Label>
              <Input id="ne-street" value={form.street}
                onChange={(e) => set("street", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-district">District</Label>
              <Input id="ne-district" value={form.district}
                onChange={(e) => set("district", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-state">State</Label>
              <Input id="ne-state" value={form.state}
                onChange={(e) => set("state", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ne-pincode">Pincode</Label>
              <Input id="ne-pincode" value={form.pincode}
                onChange={(e) => set("pincode", e.target.value)} />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={createMutation.isPending}>
          {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {createMutation.isPending ? "Creating…" : "Create Employee"}
        </Button>
      </div>
    </Dialog>
  );
}

interface EditEmployeeForm {
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  aadhar: string;
  gender: string;
  dob: string;
  industry: string;
  roleCode: string;
  departmentId: string;
  designationId: string;
  officeLocationId: string;
  dateOfJoining: string;
  house: string;
  street: string;
  district: string;
  state: string;
  pincode: string;
  designationTitle: string;
  departmentTitle: string;
  positionTitle: string;
  bloodGroup: string;
  pan: string;
  alternatePhone: string;
  personalEmail: string;
  emergencyContact: string;
  emergencyContactRelation: string;
  profileStatus: string;
}

function EditEmployeeDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EditEmployeeForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["employee", id],
    queryFn: async () =>
      (await api.get<ApiEnvelope<Profile>>(`/users/${id}`)).data.data
  });

  useEffect(() => {
    if (detail.data) {
      const p = detail.data;
      setForm({
        employeeCode: p.employeeCode || "",
        name: p.name || "",
        email: p.email || "",
        phone: p.phone || "",
        aadhar: p.aadhar || "",
        gender: p.gender || "",
        dob: p.dob || "",
        industry: p.industry || "IT",
        roleCode: p.roles?.[0] || "",
        departmentId: p.departmentId ? String(p.departmentId) : "",
        designationId: p.designationId ? String(p.designationId) : "",
        officeLocationId: p.officeLocationId ? String(p.officeLocationId) : "",
        dateOfJoining: p.dateOfJoining || "",
        house: p.address?.house || "",
        street: p.address?.street || "",
        district: p.address?.district || "",
        state: p.address?.state || "",
        pincode: p.address?.pincode || "",
        designationTitle: p.designationTitle || "",
        departmentTitle: p.departmentTitle || "",
        positionTitle: p.positionTitle || "",
        bloodGroup: p.bloodGroup || "",
        pan: p.pan || "",
        alternatePhone: p.alternatePhone || "",
        personalEmail: p.personalEmail || "",
        emergencyContact: p.emergencyContact || "",
        emergencyContactRelation: p.emergencyContactRelation || "",
        profileStatus: p.profileStatus || "ACTIVE"
      });
    }
  }, [detail.data]);

  const set = (key: keyof EditEmployeeForm, value: string) => {
    if (!form) return;
    setForm((f) => f ? ({ ...f, [key]: value }) : null);
  };

  const dropdowns = useQuery({
    queryKey: ["org-dropdowns", "employee-edit-form", form?.industry],
    enabled: !!form?.industry,
    queryFn: async () => {
      const res = await api.post<ApiEnvelope<Record<string, DropdownItem[]>>>(
        `/org/dropdowns?industry=${encodeURIComponent(form?.industry || "IT")}`,
        ["department", "designation", "office_location"]
      );
      return res.data.data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: EditEmployeeForm) => {
      const body = {
        name: payload.name.trim(),
        email: payload.email.trim() || undefined,
        phone: payload.phone.trim() || undefined,
        aadhar: payload.aadhar.trim() || undefined,
        gender: payload.gender || undefined,
        dob: payload.dob || undefined,
        industry: payload.industry,
        roles: payload.roleCode ? [payload.roleCode] : [],
        departmentId: payload.departmentId ? Number(payload.departmentId) : undefined,
        designationId: payload.designationId ? Number(payload.designationId) : undefined,
        officeLocationId: payload.officeLocationId ? Number(payload.officeLocationId) : undefined,
        house: payload.house.trim() || undefined,
        street: payload.street.trim() || undefined,
        district: payload.district.trim() || undefined,
        state: payload.state.trim() || undefined,
        pincode: payload.pincode.trim() || undefined,
        designationTitle: payload.designationTitle.trim() || undefined,
        departmentTitle: payload.departmentTitle.trim() || undefined,
        positionTitle: payload.positionTitle.trim() || undefined,
        bloodGroup: payload.bloodGroup.trim() || undefined,
        pan: payload.pan.trim().toUpperCase() || undefined,
        alternatePhone: payload.alternatePhone.trim() || undefined,
        personalEmail: payload.personalEmail.trim() || undefined,
        emergencyContact: payload.emergencyContact.trim() || undefined,
        emergencyContactRelation: payload.emergencyContactRelation.trim() || undefined,
        profileStatus: payload.profileStatus,
        employeeCode: payload.employeeCode.trim() || undefined,
        dateOfJoining: payload.dateOfJoining || undefined
      };
      const res = await api.put<ApiEnvelope<Profile>>(`/users/${id}`, body);
      return res.data.data;
    },
    onSuccess: async (updated) => {
      toast.success(`${updated.name} updated successfully!`);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (err) => {
      setError(apiMessage(err, "Could not update employee"));
    }
  });

  function submit() {
    if (!form) return;
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (form.aadhar && !/^\d{12}$/.test(form.aadhar)) {
      setError("Aadhaar must be exactly 12 digits (or leave it blank)");
      return;
    }
    if (form.phone && !/^\d{10,15}$/.test(form.phone)) {
      setError("Phone must be 10–15 digits (or leave it blank)");
      return;
    }
    updateMutation.mutate(form);
  }

  if (detail.isLoading || !form) {
    return (
      <Dialog open onClose={onClose} className="max-w-2xl">
        <DialogHeader title="Edit Employee" />
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Dialog>
    );
  }

  const departments = dropdowns.data?.department ?? [];
  const designations = dropdowns.data?.designation ?? [];
  const offices = dropdowns.data?.office_location ?? [];

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader
        title="Edit Employee Profile"
        description="Update personal details, employment information, additional data, and address block."
      />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Personal details
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ee-name">Full name *</Label>
              <Input id="ee-name" value={form.name}
                onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-email">Email</Label>
              <Input id="ee-email" type="email" value={form.email}
                onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-phone">Phone</Label>
              <Input id="ee-phone" value={form.phone}
                onChange={(e) => set("phone", e.target.value)} placeholder="10-digit mobile" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-aadhar">Aadhaar</Label>
              <Input id="ee-aadhar" value={form.aadhar} inputMode="numeric" maxLength={12}
                onChange={(e) => set("aadhar", e.target.value)} placeholder="12 digits" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-gender">Gender</Label>
              <Select id="ee-gender" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">—</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-dob">Date of birth</Label>
              <Input id="ee-dob" type="date" value={form.dob}
                onChange={(e) => set("dob", e.target.value)} />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Employment
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ee-code">Employee code</Label>
              <Input id="ee-code" value={form.employeeCode}
                onChange={(e) => set("employeeCode", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-industry">Industry</Label>
              <Select id="ee-industry" value={form.industry}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm(f => f ? ({
                    ...f,
                    industry: val,
                    roleCode: val === "CIVIL" ? "CV_EMP" : "IT_EMP",
                    designationId: ""
                  }) : null);
                }}>
                <option value="IT">IT</option>
                <option value="CIVIL">Civil</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-role">Role</Label>
              <Select id="ee-role" value={form.roleCode}
                onChange={(e) => set("roleCode", e.target.value)}>
                {ROLE_OPTIONS.filter(r => {
                  if (form.industry === "CIVIL") return r.code.startsWith("CV_");
                  return r.code.startsWith("IT_") || r.code === "SUPER_ADMIN";
                }).map((r) => (
                  <option key={r.code} value={r.code}>{r.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-dept">Department</Label>
              <Select id="ee-dept" value={form.departmentId}
                onChange={(e) => set("departmentId", e.target.value)}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-desig">Designation</Label>
              <Select id="ee-desig" value={form.designationId}
                onChange={(e) => set("designationId", e.target.value)}>
                <option value="">—</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-office">Office location</Label>
              <Select id="ee-office" value={form.officeLocationId}
                onChange={(e) => set("officeLocationId", e.target.value)}>
                <option value="">—</option>
                {offices.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-doj">Date of joining</Label>
              <Input id="ee-doj" type="date" value={form.dateOfJoining}
                onChange={(e) => set("dateOfJoining", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-position">Position</Label>
              <Input id="ee-position" value={form.positionTitle}
                onChange={(e) => set("positionTitle", e.target.value)} placeholder="e.g. Software Developer" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-status">Profile Status</Label>
              <Select id="ee-status" value={form.profileStatus}
                onChange={(e) => set("profileStatus", e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="OFFBOARDED">Offboarded</option>
              </Select>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Additional details
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ee-blood">Blood group</Label>
              <Input id="ee-blood" value={form.bloodGroup}
                onChange={(e) => set("bloodGroup", e.target.value)} placeholder="e.g. B+" maxLength={5} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-pan">PAN</Label>
              <Input id="ee-pan" className="uppercase" value={form.pan}
                onChange={(e) => set("pan", e.target.value)} placeholder="10-char PAN" maxLength={10} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-alt">Alternate phone</Label>
              <Input id="ee-alt" value={form.alternatePhone}
                onChange={(e) => set("alternatePhone", e.target.value)} placeholder="10-digit mobile" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-pemail">Personal email</Label>
              <Input id="ee-pemail" type="email" value={form.personalEmail}
                onChange={(e) => set("personalEmail", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-emc">Emergency contact</Label>
              <Input id="ee-emc" value={form.emergencyContact}
                onChange={(e) => set("emergencyContact", e.target.value)} placeholder="Name / number" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-emr">Emergency contact relation</Label>
              <Input id="ee-emr" value={form.emergencyContactRelation}
                onChange={(e) => set("emergencyContactRelation", e.target.value)} placeholder="e.g. Father" />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Address (optional)
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="ee-house">House / building</Label>
              <Input id="ee-house" value={form.house}
                onChange={(e) => set("house", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-street">Street</Label>
              <Input id="ee-street" value={form.street}
                onChange={(e) => set("street", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-district">District</Label>
              <Input id="ee-district" value={form.district}
                onChange={(e) => set("district", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-state">State</Label>
              <Input id="ee-state" value={form.state}
                onChange={(e) => set("state", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ee-pincode">Pincode</Label>
              <Input id="ee-pincode" value={form.pincode}
                onChange={(e) => set("pincode", e.target.value)} />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onClose} disabled={updateMutation.isPending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {updateMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </Dialog>
  );
}
