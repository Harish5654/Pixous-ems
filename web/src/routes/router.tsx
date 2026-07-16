import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { RoleGuard } from "@/components/layout/RoleGuard";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import AttendancePage from "@/pages/Attendance";
import LeavePage from "@/pages/Leave";
import LeaveApprovalsPage from "@/pages/LeaveApprovals";
import PayslipsPage from "@/pages/Payslips";
import EmployeesPage from "@/pages/Employees";
import AssetsPage from "@/pages/Assets";
import HelpdeskPage from "@/pages/Helpdesk";
import ComplaintsPage from "@/pages/Complaints";
import ProfilePage from "@/pages/Profile";
import NotificationsPage from "@/pages/Notifications";
import NotFoundPage from "@/pages/NotFound";
import PayrollRunsPage from "@/pages/PayrollRuns";
import TeamAttendancePage from "@/pages/TeamAttendance";
import LeavePoliciesPage from "@/pages/LeavePolicies";
import TaExpensesPage from "@/pages/TaExpenses";
import { ModulePlaceholder } from "@/pages/ModulePlaceholder";
import ReportsPage from "@/pages/Reports";
import OnboardingPage from "@/pages/Onboarding";
import PayrollRequestsPage from "@/pages/PayrollRequests";
import WorkReportsPage from "@/pages/WorkReports";
import CommunitiesPage from "@/pages/Communities";
import ChatPage from "@/pages/Chat";
import AdminChatbotSettings from "@/pages/AdminChatbotSettings";
import CalendarPage from "@/pages/Calendar";
import SafetyPage from "@/pages/Safety";
import TasksPage from "@/pages/Tasks";
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "attendance", element: <AttendancePage /> },
      {
        path: "team-attendance",
        element: (
          <RoleGuard permission="ATTENDANCE_TEAM">
            <TeamAttendancePage />
          </RoleGuard>
        )
      },
      { path: "leave", element: <LeavePage /> },
      {
        path: "leave/approvals",
        element: (
          <RoleGuard permission="LEAVE_APPROVE">
            <LeaveApprovalsPage />
          </RoleGuard>
        )
      },
      {
        path: "leave/policies",
        element: (
          <RoleGuard permission="ORG_MANAGE">
            <LeavePoliciesPage />
          </RoleGuard>
        )
      },
      { path: "payslips", element: <PayslipsPage /> },
      {
        path: "payroll/requests",
        element: (
          <RoleGuard permission="PAYROLL_RUN">
            <PayrollRequestsPage />
          </RoleGuard>
        )
      },
      { path: "work-reports", element: <WorkReportsPage /> },
      {
        path: "employees",
        element: (
          <RoleGuard permission="USER_MANAGE,ATTENDANCE_TEAM,REPORT_VIEW">
            <EmployeesPage />
          </RoleGuard>
        )
      },
      { path: "assets", element: <AssetsPage /> },
      { path: "helpdesk", element: <HelpdeskPage /> },
      { path: "complaints", element: <ComplaintsPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "ta-expenses", element: <TaExpensesPage /> },

      // Scaffolded modules — routed so navigation is complete end-to-end.
      {
        path: "payroll/run",
        element: (
          <RoleGuard permission="PAYROLL_RUN,PAYROLL_APPROVE">
            <PayrollRunsPage />
          </RoleGuard>
        )
      },
      {
        path: "onboarding",
        element: (
          <RoleGuard permission="USER_MANAGE">
            <OnboardingPage />
          </RoleGuard>
        )
      },
      {
        path: "safety",
        element: <SafetyPage />
      },
      {
        path: "reports",
        element: (
          <RoleGuard permission="REPORT_VIEW">
            <ReportsPage />
          </RoleGuard>
        )
      },
      {
        path: "communities",
        element: (
          <RoleGuard permission="ORG_MANAGE">
            <CommunitiesPage />
          </RoleGuard>
        )
      },
      {
        path: "projects",
        element: (
          <RoleGuard permission="ORG_MANAGE">
            <ModulePlaceholder
              title="Projects"
              summary="Track and manage company projects, milestones and deliverables."
              endpoints={["org.projects"]}
            />
          </RoleGuard>
        )
      },
      {
        path: "tasks",
        element: <TasksPage />
      },
      {
        path: "documents",
        element: (
          <RoleGuard permission="ORG_MANAGE">
            <ModulePlaceholder
              title="Documents"
              summary="Manage company documents, policies and HR forms."
              endpoints={["org.documents"]}
            />
          </RoleGuard>
        )
      },
      {
        path: "calendar",
        element: <CalendarPage />
      },
      {
        path: "chat",
        element: <ChatPage />
      },
      {
        path: "admin/ai-assistant",
        element: (
          <RoleGuard permission="USER_MANAGE">
            <AdminChatbotSettings />
          </RoleGuard>
        )
      }
    ]
  },
  { path: "*", element: <NotFoundPage /> }
]);
