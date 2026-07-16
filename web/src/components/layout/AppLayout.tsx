import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, Clock, CalendarCheck, CheckSquare, Wallet, Users, Boxes,
  LifeBuoy, User, Bell, Menu, X, Moon, Sun, LogOut, ShieldCheck,
  FileBarChart, ClipboardList, Settings, Map, MessageSquareWarning, FileText,
  FolderOpen, ListTodo, FileArchive, CalendarDays, MoreVertical, ChevronDown, Bot
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { ChatBotWidget } from "@/components/ChatBotWidget";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  anyPermission?: string[];
  excludeRole?: string[];
  end?: boolean;
}

interface NavGroup {
  type: "group";
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPath: string;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

const NAV: NavEntry[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/employees", label: "Employees", icon: Users, anyPermission: ["USER_MANAGE", "ATTENDANCE_TEAM", "REPORT_VIEW"] },
  { to: "/attendance", label: "Attendance", icon: Clock },
  { to: "/team-attendance", label: "    Employee Attendance      ", icon: Users, anyPermission: ["ATTENDANCE_TEAM"] },
  // ─── Leave Management (collapsible group) ───────────────────────────────────
  {
    type: "group",
    key: "leave-management",
    label: "Leave Management",
    icon: CalendarCheck,
    matchPath: "/leave",
    children: [
      { to: "/leave", label: "Leave", icon: CalendarCheck, end: true, excludeRole: ["SUPER_ADMIN"] },
      { to: "/leave/approvals", label: "Approvals", icon: CheckSquare, anyPermission: ["LEAVE_APPROVE"] },
      { to: "/leave/policies", label: "Leave Policies", icon: Settings, anyPermission: ["ORG_MANAGE"] }
    ]
  },
  // ────────────────────────────────────────────────────────────────────────────
  // ─── Payroll (collapsible group) ────────────────────────────────────────────
  {
    type: "group",
    key: "payroll",
    label: "Payroll",
    icon: Wallet,
    matchPath: "/payroll",
    children: [
      { to: "/payroll/requests", label: "Payslip Requests", icon: FileText, anyPermission: ["PAYROLL_RUN"] },
      { to: "/payslips", label: "Payslips", icon: Wallet, excludeRole: ["SUPER_ADMIN"] }
    ]
  },
  // ────────────────────────────────────────────────────────────────────────────
  { to: "/work-reports", label: "Work Reports", icon: ClipboardList },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/documents", label: "Documents", icon: FileArchive, anyPermission: ["ORG_MANAGE"], excludeRole: ["SUPER_ADMIN"] },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/ta-expenses", label: "Claims", icon: Map },
  { to: "/assets", label: "Assets", icon: Boxes },
  { to: "/helpdesk", label: "Helpdesk", icon: LifeBuoy },
  { to: "/complaints", label: "Complaints / Needs", icon: MessageSquareWarning },
  { to: "/onboarding", label: "Onboarding", icon: ClipboardList, anyPermission: ["USER_MANAGE"] },
  { to: "/safety", label: "Safety", icon: ShieldCheck },
  { to: "/reports", label: "Reports", icon: FileBarChart, anyPermission: ["REPORT_VIEW"], excludeRole: ["SUPER_ADMIN"] },
  { to: "/communities", label: "Communities", icon: Users, anyPermission: ["ORG_MANAGE"] },
  { to: "/chat", label: "Chat", icon: MessageSquareWarning },
  { to: "/admin/ai-assistant", label: "AI Assistant", icon: Bot, anyPermission: ["USER_MANAGE"] }
];

function getRoleDisplayName(roles: string[] = []): string {
  if (roles.includes("BOARD_ADMIN")) return "Board Admin";
  if (roles.includes("SUPER_ADMIN")) return "Super Admin";
  if (roles.includes("IT_HR")) return "HR Manager";
  if (roles.includes("IT_MANAGER")) return "Manager";
  if (roles.includes("IT_EMP")) return "Employee";
  if (roles.includes("CV_MANAGER")) return "Site Manager";
  if (roles.includes("CV_EMP")) return "Field Employee";
  if (roles.length > 0) return roles[0].replace(/_/g, " ");
  return "Employee";
}

export function AppLayout() {
  const { user, logout, hasPermission, hasRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { notifications, unreadCount, markAllRead } = useNotifications(user?.id);

  const isSupAdmin = hasRole("SUPER_ADMIN");

  // Track open/closed state for each group by key
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => ({
    "leave-management": location.pathname.startsWith("/leave"),
    "payroll": location.pathname.startsWith("/payroll") || location.pathname.startsWith("/payslips")
  }));

  const toggleGroup = (key: string) =>
    setGroupOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  // Build visible nav — handle group entries inline
  const visibleNav = NAV.map((entry) => {
    if ("type" in entry && entry.type === "group") {
      const visibleChildren = entry.children.filter(
        (c) =>
          !(c.excludeRole?.some((r) => hasRole(r))) &&
          (!c.anyPermission || hasPermission(...c.anyPermission) || isSupAdmin)
      );
      if (visibleChildren.length === 0) return null;
      return { ...entry, children: visibleChildren };
    }
    const item = entry as NavItem;
    if (item.excludeRole?.some((r) => hasRole(r))) return null;
    if (!item.anyPermission || hasPermission(...item.anyPermission) || isSupAdmin) return item;
    return null;
  }).filter(Boolean) as (NavItem | NavGroup)[];

  const isNavGroup = (grp: NavEntry): grp is NavGroup =>
    "type" in grp && grp.type === "group";

  const roleLabel = getRoleDisplayName(user?.roles);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 text-slate-100 transition-transform duration-200 lg:static lg:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo Header */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4 shrink-0">
          <img
            src="https://pixoustech.com/public/assets/images/common/pixous-logo1.png"
            alt="Pixous Technologies Logo"
            className="h-14 w-[210px] object-contain p-1 rounded-lg bg-white shadow-sm"
          />
          <button
            className="ml-auto rounded-md p-1 text-white/70 hover:bg-white/10 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-2 text-center border-b border-white/5 bg-white/[0.01] shrink-0">
          <span className="text-[10px] font-bold tracking-wider text-white/80 uppercase">
            Employee Management System
          </span>
        </div>

        {/* Nav Links (scrollable) */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {visibleNav.map((entry) => {
            // ── Collapsible group ──
            if (isNavGroup(entry)) {
              const grp = entry as NavGroup;
              const isOnGroup = location.pathname.startsWith(grp.matchPath)
                || (grp.key === "payroll" && location.pathname.startsWith("/payslips"));
              const isOpen = !!groupOpen[grp.key];
              return (
                <div key={grp.key}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(grp.key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isOnGroup
                        ? "bg-primary/20 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <grp.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1 text-left">{grp.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-white/50 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                      {grp.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end={child.end ?? true}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-white/60 hover:bg-white/10 hover:text-white"
                            )
                          }
                        >
                          <child.icon className="h-[15px] w-[15px] shrink-0" />
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            // ── Regular nav link ──
            const item = entry as NavItem;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <button
            onClick={() => { setSidebarOpen(false); navigate("/profile"); }}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-white/10 group"
          >
            <div className="relative shrink-0">
              <Avatar
                name={user?.name}
                src={user?.photoPath}
                className="h-10 w-10 ring-2 ring-white/20 shadow-md"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-bold text-white leading-tight">
                {user?.name ?? "—"}
              </div>
              <div className="truncate text-[10px] font-semibold text-white/50 leading-tight mt-0.5">
                {roleLabel}
              </div>
            </div>
            <MoreVertical className="h-4 w-4 text-white/40 group-hover:text-white/70 shrink-0" />
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 lg:px-6">
          <button
            className="rounded-md p-2 hover:bg-muted lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="ml-auto flex items-center gap-1">
            {/* Notification bell */}
            <div className="relative">
              <button
                className="relative rounded-md p-2 hover:bg-muted"
                onClick={() => setBellOpen((v) => !v)}
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setBellOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border bg-popover shadow-lg animate-fade-in">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <span className="font-display text-sm font-semibold">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => markAllRead()}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                          You're all caught up.
                        </p>
                      ) : (
                        notifications.slice(0, 8).map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              setBellOpen(false);
                              if (n.link) navigate(n.link);
                            }}
                            className={cn(
                              "flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/60",
                              !n.read && "bg-primary/5"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                              <span className="text-sm font-medium">{n.title}</span>
                            </div>
                            {n.body && (
                              <span className="text-xs text-muted-foreground">{n.body}</span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              {dayjs(n.createdAt).format("DD MMM, h:mm A")}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      className="block w-full border-t px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-muted/60"
                      onClick={() => {
                        setBellOpen(false);
                        navigate("/notifications");
                      }}
                    >
                      View all
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Theme toggle */}
            <button
              className="rounded-md p-2 hover:bg-muted"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 dark:hidden" />
              <Moon className="hidden h-5 w-5 dark:block" />
            </button>

            {/* User menu */}
            <div className="relative ml-1">
              <button
                className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-muted"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <Avatar name={user?.name} src={user?.photoPath} />
                <div className="hidden text-left leading-tight sm:block">
                  <div className="text-sm font-medium">{user?.name}</div>
                  <div className="code-chip text-[11px] text-muted-foreground">
                    {user?.employeeCode}
                  </div>
                </div>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-popover p-1.5 shadow-lg animate-fade-in">
                    <div className="px-3 py-2">
                      <div className="text-sm font-medium">{user?.name}</div>
                      <div className="text-xs text-muted-foreground">{user?.email}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {user?.roles?.slice(0, 3).map((r) => (
                          <Badge key={r} variant="secondary" className="text-[10px]">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="my-1 border-t" />
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate("/profile");
                      }}
                    >
                      <User className="h-4 w-4" /> My profile
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        logout();
                        navigate("/login");
                      }}
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Routed content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <ChatBotWidget />
    </div>
  );
}
