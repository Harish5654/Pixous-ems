// Shared API types — mirror the backend DTOs.

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
  timestamp: string;
}

export interface PageEnvelope<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  employeeCode: string;
  email?: string;
  industry?: string;
  photoPath?: string;
  roles: string[];
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: number;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: TokenPair;
}

export interface AddressDto {
  careOf?: string;
  house?: string;
  street?: string;
  locality?: string;
  vtc?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
  postOffice?: string;
}

export interface Profile {
  id: number;
  employeeCode: string;
  username?: string;
  name: string;
  dob?: string;
  gender?: string;
  aadhar?: string;
  phone?: string;
  email?: string;
  photoPath?: string;
  address?: AddressDto;
  departmentId?: number;
  designationId?: number;
  officeLocationId?: number;
  reportingManagerId?: number;
  industry?: string;
  employmentType?: string;
  dateOfJoining?: string;
  profileStatus?: string;
  pan?: string;
  alternatePhone?: string;
  emergencyContact?: string;
  emergencyContactRelation?: string;
  bloodGroup?: string;
  personalEmail?: string;
  designationTitle?: string;
  departmentTitle?: string;
  positionTitle?: string;
  roles: string[];
}

export interface BankResponse {
  id: number;
  bankName: string;
  branchName?: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName?: string;
  primary: boolean;
}

export interface UserSummary {
  id: number;
  employeeCode: string;
  name: string;
  email?: string;
  phone?: string;
  industry?: string;
  departmentId?: number;
  profileStatus?: string;
  photoPath?: string;
  dob?: string;
  roles?: string[];
}

export interface AttendanceRecord {
  id: number;
  userId: number;
  workDate: string;
  punchInAt?: string;
  punchOutAt?: string;
  mode: string;
  withinGeofence?: boolean;
  status: string;
  late: boolean;
  workedMinutes?: number;
  overtimeMinutes?: number;
  geofenceException?: boolean;
  inLatitude?: number;
  inLongitude?: number;
  outLatitude?: number;
  outLongitude?: number;
}

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  maxDaysPerYear?: number;
  carryForward: boolean;
  encashable: boolean;
  genderRestriction?: string;
  allowPastDates: boolean;
  minNoticeDays?: number;
  monthlyLimit?: number;
}

export interface LeaveBalance {
  leaveTypeId: number;
  leaveTypeName: string;
  leaveTypeCode: string;
  year: number;
  allocated: number;
  used: number;
  available: number;
}

export interface LeaveRequest {
  id: number;
  userId: number;
  employeeName: string;
  leaveTypeId: number;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  workingDays: number;
  reason?: string;
  status: string;
  decidedBy?: number;
  decidedAt?: string;
  decisionComment?: string;
  createdAt: string;
}

export interface PayslipSummary {
  id: number;
  payMonth: number;
  payYear: number;
  grossSalary: number;
  netPay: number;
  pdfPath?: string;
}

export interface Payslip extends PayslipSummary {
  userId: number;
  employeeName: string;
  employeeCode: string;
  basicSalary: number;
  hra: number;
  allowances: number;
  overtimePay: number;
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  tdsDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  lopDays: number;
  generatedAt: string;
  // customizable fields (V15)
  companyName?: string;
  companyLogo?: string;
  companyGstin?: string;
  companyAddress?: string;
  bankName?: string;
  bankAccount?: string;
  designation?: string;
  department?: string;
  payDate?: string;
  workingDays?: number;
  performancePay?: number;
  expensesPay?: number;
  salaryAdvance?: number;
  healthInsurance?: number;
  source?: string;
}

export interface PayslipRequest {
  id: number;
  userId: number;
  employeeName: string;
  employeeCode: string;
  payMonth: number;
  payYear: number;
  note?: string;
  status: string; // PENDING | APPROVED | REJECTED
  payslipId?: number;
  decisionNote?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface WorkReport {
  id: number;
  userId: number;
  employeeName: string;
  employeeCode: string;
  workDate: string;
  projectName: string;
  workHours: number;
  taskDescription?: string;
}

export interface EmployeeWorkList {
  userId: number;
  employeeName: string;
  employeeCode: string;
  totalRows: number;
  totalHours: number;
  rows: WorkReport[];
}

export interface TaskItem {
  id: number;
  title: string;
  description?: string;
  assignedTo: number;
  assigneeName?: string;
  assigneeCode?: string;
  assigneeIndustry?: string;
  assignedBy?: number;
  assignerName?: string;
  status: string; // PENDING | COMPLETED
  dueDate?: string;
  createdAt?: string;
  completedAt?: string;
}

export interface EmployeeTaskGroup {
  userId: number;
  employeeName: string;
  employeeCode: string;
  industry?: string;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  tasks: TaskItem[];
}

export interface Asset {
  id: number;
  assetCode: string;
  category: string;
  assetType?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  registrationNo?: string;
  status: string;
  siteId?: number;
  assignedTo?: number;
  qrPath?: string;
}

export interface TicketComment {
  id: number;
  authorId: number;
  authorName: string;
  comment: string;
  attachmentPath?: string;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketCode: string;
  raisedBy: number;
  raisedByName: string;
  title: string;
  description?: string;
  type: string;
  category?: string;
  priority: string;
  status: string;
  assignedTo?: number;
  assignedToName?: string;
  slaDueAt?: string;
  rating?: number;
  resolvedAt?: string;
  createdAt: string;
  comments?: TicketComment[];
}

export interface AppNotification {
  id: number;
  title: string;
  body?: string;
  type?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface EmployeeDashboard {
  employeeName: string;
  employeeCode: string;
  punchedInToday: boolean;
  punchInAt?: string;
  punchOutAt?: string;
  workedMinutesToday?: number;
  leaveBalances: LeaveBalance[];
  pendingLeaveRequests: number;
  myOpenTickets: number;
  myAssets: number;
  recentNotifications: AppNotification[];
}

export interface ExecutiveDashboard {
  headcount: number;
  presentToday: number;
  attendancePercentToday: number;
  pendingLeaveApprovals: number;
  openTickets: number;
  assetsAssigned: number;
  assetsInStock: number;
  departmentBreakdown: Record<string, number>;
  monthlyAttendanceTrend: any[];
  leaveUtilization: Record<string, number>;
  payrollCosts: any[];
}

export interface PayrollRunResponse {
  id: number;
  runMonth: number;
  runYear: number;
  status: string;
  totalEmployees: number;
  totalGross: number;
  totalNet: number;
  createdAt: string;
}

export interface HolidayResponse {
  id: number;
  name: string;
  holidayDate: string;
}

export interface ExpenseClaimResponse {
  id: number;
  userId: number;
  category: string;
  amount: number;
  claimDate: string;
  receiptPath?: string;
  managerStatus: string;
  financeStatus: string;
  createdAt: string;
}

export interface OnboardingTaskResponse {
  id: number;
  taskName: string;
  description?: string;
  isCompleted: boolean;
  completedAt?: string;
}

export interface OnboardingChecklistResponse {
  id: number;
  userId: number;
  status: string;
  startedAt: string;
  completedAt?: string;
  tasks: OnboardingTaskResponse[];
}

export interface PerformanceGoalResponse {
  id: number;
  userId: number;
  title: string;
  description?: string;
  progress: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceReviewResponse {
  id: number;
  userId: number;
  managerId: number;
  reviewPeriod: string;
  selfRating?: number;
  selfComment?: string;
  managerRating?: number;
  managerComment?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DropdownItem {
  id: number;
  label: string;
}

export interface ComplaintNeed {
  id: number;
  referenceCode: string;
  raisedBy: number;
  raisedByName: string;
  kind: string; // COMPLAINT | NEED
  category?: string;
  subject: string;
  description: string;
  priority: string; // LOW | MEDIUM | HIGH
  status: string; // OPEN | IN_REVIEW | RESOLVED | REJECTED
  hrResponse?: string;
  handledBy?: number;
  handledByName?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyIncident {
  id: number;
  referenceCode: string;
  reportedBy: number;
  reportedByName: string;
  incidentType: string;
  description: string;
  zone?: string;
  anonymous: boolean;
  severity: string;
  status: string;
  occurredAt?: string;
  resolutionNotes?: string;
  resolvedBy?: number;
  resolvedByName?: string;
  resolvedAt?: string;
  createdAt: string;
}
