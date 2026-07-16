import * as XLSX from "xlsx";

/** Payload matching the backend CreateEmployeeRequest (subset used by import). */
export interface EmployeeImportPayload {
  username: string;
  password: string;
  name: string;
  email?: string;
  phone?: string;
  aadhar?: string;
  dob?: string;
  dateOfJoining?: string;
  industry: string;
  roleCode: string;
  designationTitle?: string;
  departmentTitle?: string;
  positionTitle?: string;
  bloodGroup?: string;
  pan?: string;
  alternatePhone?: string;
  personalEmail?: string;
  emergencyContact?: string;
  emergencyContactRelation?: string;
  street?: string;
  district?: string;
  profileStatus: string;
}

export interface ImportCred {
  empId: string;
  name: string;
  username: string;
  password: string;
  status: string;
  designation: string;
}

const digits = (v: unknown) => String(v == null ? "" : v).replace(/\D/g, "");
const norm = (id: unknown) => String(id ?? "").toUpperCase().replace(/\s/g, "").trim();

function cleanAadhaar(v: unknown): string | undefined {
  const d = digits(v);
  return d.length === 12 ? d : undefined;
}
function cleanPhone(v: unknown): string | undefined {
  const d = digits(v);
  return d.length >= 10 && d.length <= 15 ? d : undefined;
}
function cap(s: string): string {
  s = String(s || "").trim();
  return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}
function clean(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  return !s || /^na$/i.test(s) ? undefined : s;
}
function parseDate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const raw = String(v).trim();
  if (typeof v === "number" || /^\d{4,6}$/.test(raw)) {
    const serial = Number(v);
    if (serial > 20000 && serial < 60000) {
      const ms = Date.UTC(1899, 11, 30) + serial * 86400000;
      return new Date(ms).toISOString().slice(0, 10);
    }
  }
  let m = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) {
    const d = +m[1], mo = +m[2], y = m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31)
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  m = raw.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  return undefined;
}
function industryOf(e: any): string {
  const t = `${e.designation || ""} ${e.department || ""} ${e.position || ""}`.toLowerCase();
  return /civil|facilit|construc|industrial|infra/.test(t) ? "CIVIL" : "IT";
}
function roleOf(e: any, ind: string): string {
  const t = `${e.designation || ""} ${e.position || ""}`.toLowerCase();
  if (ind === "CIVIL") return /consultant|manager|supervisor|lead/.test(t) ? "CV_SUP" : "CV_EMP";
  return /lead|cto|chief|manager|head|director/.test(t) ? "IT_MGR" : "IT_EMP";
}
const isWorking = (e: any) => String(e.status || "").trim().toLowerCase() === "working";

/**
 * Parse a Pixous-style employee workbook into create payloads + a credential
 * list. Consolidates the Employee List / Details / Documents / Bank Info sheets
 * by Emp ID. Username = lowercase Emp ID, password = Firstname@123.
 */
export async function parseEmployeeWorkbook(
  file: File
): Promise<{ payloads: EmployeeImportPayload[]; creds: ImportCred[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = (name: string) =>
    wb.Sheets[name] ? XLSX.utils.sheet_to_json<any>(wb.Sheets[name], { defval: "" }) : [];

  const byId: Record<string, any> = {};
  const ens = (id: unknown) => {
    const k = norm(id);
    if (!k) return null;
    if (!byId[k]) byId[k] = { empId: k };
    return byId[k];
  };

  for (const r of sheet("Employee List")) {
    const e = ens(r["Emp Id"]);
    if (!e) continue;
    e.name = r["Name"]; e.firstName = r["First Name"]; e.status = r["Status"];
    e.position = r["Position"]; e.designation = r["Designation"]; e.mobile = r["Mobile no"];
    e.department = r["Department"]; e.officeEmail = r["Office email"]; e.office = r["Primary Office"];
  }
  for (const r of sheet("Employee Details")) {
    const e = ens(r["Emp number"]);
    if (!e) continue;
    e.bloodGroup = r["Blood Group "] || r["Blood Group"]; e.startDate = r["Start date"];
    e.dob = r["Date of birth"]; e.personalEmail = r["Personal email"]; e.address = r["Address"]; e.district = r["District"];
    e.emergencyContact = r["Emergency Contact"]; e.emergencyRel = r["Emergency Contact Relation"]; e.altNo = r["Alternate no"];
    if (!e.designation) e.designation = r["Designation"];
    if (!e.firstName) e.firstName = r["First Name"];
  }
  for (const r of sheet("Employee Documents")) {
    const e = ens(r["Emp number"]);
    if (!e) continue;
    e.aadhaar = r["Aadhaar"]; e.pan = r["PAN"];
  }
  for (const r of sheet("Employee Bank Info")) {
    const e = ens(r["Emp number"]);
    if (!e) continue;
    if (!e.aadhaar) e.aadhaar = r["Aadhar number"];
    if (!e.pan) e.pan = r["Pan number"];
    if (!e.mobile) e.mobile = r["Mobile no"];
  }

  const all = Object.values(byId).filter((e: any) => e.name && String(e.name).trim());
  const seenPhone = new Set<string>();
  const seenAadhaar = new Set<string>();
  const payloads: EmployeeImportPayload[] = [];
  const creds: ImportCred[] = [];

  for (const e of all) {
    const fnRaw = String(e.firstName || e.name || "").trim().split(/\s+/)[0].replace(/[^A-Za-z]/g, "");
    let password = cap(fnRaw) + "@123";
    if (password.length < 8) password = cap(fnRaw) + "@2025";
    const username = e.empId.toLowerCase();

    let phone = cleanPhone(e.mobile);
    if (phone && seenPhone.has(phone)) phone = undefined;
    if (phone) seenPhone.add(phone);
    let aadhaar = cleanAadhaar(e.aadhaar);
    if (aadhaar && seenAadhaar.has(aadhaar)) aadhaar = undefined;
    if (aadhaar) seenAadhaar.add(aadhaar);

    const ind = industryOf(e);
    payloads.push({
      username,
      password,
      name: String(e.name).trim(),
      email: clean(e.officeEmail)?.toLowerCase() || clean(e.personalEmail)?.toLowerCase(),
      phone,
      aadhar: aadhaar || "",
      dob: parseDate(e.dob),
      dateOfJoining: parseDate(e.startDate),
      industry: ind,
      roleCode: roleOf(e, ind),
      designationTitle: clean(e.designation),
      departmentTitle: clean(e.department),
      positionTitle: clean(e.position),
      bloodGroup: clean(e.bloodGroup),
      pan: clean(e.pan)?.toUpperCase(),
      alternatePhone: cleanPhone(e.altNo),
      personalEmail: clean(e.personalEmail)?.toLowerCase(),
      emergencyContact: clean(e.emergencyContact),
      emergencyContactRelation: clean(e.emergencyRel),
      street: clean(e.address),
      district: clean(e.district),
      profileStatus: isWorking(e) ? "ACTIVE" : "OFFBOARDED"
    });
    creds.push({
      empId: e.empId,
      name: String(e.name).trim(),
      username,
      password,
      status: isWorking(e) ? "ACTIVE" : "OFFBOARDED",
      designation: clean(e.designation) || ""
    });
  }
  return { payloads, creds };
}

/** Build a CSV blob of the credentials for download. */
export function credsToCsv(creds: ImportCred[]): Blob {
  const esc = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const header = ["Emp ID", "Name", "Username", "Password", "Status", "Designation"];
  const lines = [header.map(esc).join(",")];
  for (const c of creds)
    lines.push([c.empId, c.name, c.username, c.password, c.status, c.designation].map(esc).join(","));
  return new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
}
