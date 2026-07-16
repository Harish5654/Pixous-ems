package com.pixous.hrportal.modules.dashboard;

import com.pixous.hrportal.modules.asset.AssetRepository;
import com.pixous.hrportal.modules.attendance.Attendance;
import com.pixous.hrportal.modules.attendance.AttendanceRepository;
import com.pixous.hrportal.modules.dashboard.dto.EmployeeDashboard;
import com.pixous.hrportal.modules.dashboard.dto.ExecutiveDashboard;
import com.pixous.hrportal.modules.helpdesk.TicketRepository;
import com.pixous.hrportal.modules.leave.LeaveRequestRepository;
import com.pixous.hrportal.modules.leave.LeaveService;
import com.pixous.hrportal.modules.notification.Notification;
import com.pixous.hrportal.modules.notification.NotificationRepository;
import com.pixous.hrportal.modules.notification.NotificationResponse;
import com.pixous.hrportal.modules.user.User;
import com.pixous.hrportal.modules.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final UserRepository userRepository;
    private final AttendanceRepository attendanceRepository;
    private final LeaveService leaveService;
    private final LeaveRequestRepository leaveRequestRepository;
    private final TicketRepository ticketRepository;
    private final AssetRepository assetRepository;
    private final NotificationRepository notificationRepository;

    @Transactional(readOnly = true)
    public EmployeeDashboard employee(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        LocalDate today = LocalDate.now();

        Attendance att = attendanceRepository.findByUserIdAndWorkDate(userId, today).orElse(null);

        var leaveBalances = leaveService.balances(userId, today.getYear());
        long pendingLeaves = leaveRequestRepository
                .findByUserIdAndStatus(userId, "PENDING").size();
        long openTickets = ticketRepository.countByRaisedByAndStatusNot(userId, "CLOSED");
        long myAssets = assetRepository.findByAssignedTo(userId).size();

        List<NotificationResponse> recent = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 5))
                .map(NotificationResponse::from)
                .getContent();

        return new EmployeeDashboard(
                user.getName(),
                user.getEmployeeCode(),
                att != null && att.getPunchInAt() != null,
                att != null ? att.getPunchInAt() : null,
                att != null ? att.getPunchOutAt() : null,
                att != null ? att.getWorkedMinutes() : null,
                leaveBalances,
                pendingLeaves,
                openTickets,
                myAssets,
                recent);
    }

    @Transactional(readOnly = true)
    public ExecutiveDashboard executive(String industry) {
        boolean hasFilter = industry != null && !industry.trim().isEmpty();
        String filterVal = hasFilter ? industry.trim() : null;

        // Index every employee by id once so the per-record filters below do not
        // hit the database repeatedly. "" means no industry recorded.
        List<User> users = userRepository.findAll();
        java.util.Map<Long, String> industryByUser = users.stream()
                .collect(java.util.stream.Collectors.toMap(
                        User::getId,
                        u -> u.getIndustry() == null ? "" : u.getIndustry(),
                        (a, b) -> a));

        // Does a record's owner fall inside the selected industry (Overall = all)?
        java.util.function.Predicate<Long> inFilter = userId -> {
            if (filterVal == null) return true;
            String ind = industryByUser.get(userId);
            return ind != null && filterVal.equalsIgnoreCase(ind);
        };

        long headcount = users.stream()
                .filter(u -> filterVal == null || filterVal.equalsIgnoreCase(u.getIndustry()))
                .count();
        LocalDate today = LocalDate.now();

        long presentToday = attendanceRepository.findByWorkDate(today).stream()
                .filter(a -> a.getPunchInAt() != null)
                .filter(a -> inFilter.test(a.getUserId()))
                .count();
        double pct = headcount == 0 ? 0.0 : BigDecimal.valueOf(presentToday * 100.0 / headcount)
                .setScale(1, RoundingMode.HALF_UP).doubleValue();

        long pendingApprovals = leaveRequestRepository.findAll().stream()
                .filter(r -> "PENDING".equals(r.getStatus()))
                .filter(r -> inFilter.test(r.getUserId()))
                .count();

        long openTickets = ticketRepository.findAll().stream()
                .filter(t -> !"CLOSED".equals(t.getStatus()))
                .filter(t -> inFilter.test(t.getRaisedBy()))
                .count();

        long assigned = assetRepository.countByStatus("ASSIGNED");
        long inStock = assetRepository.countByStatus("IN_STOCK");

        java.util.Map<String, Long> departmentBreakdown = java.util.Map.of("Engineering", 15L, "Sales", 8L, "HR", 4L);
        java.util.List<java.util.Map<String, Object>> monthlyAttendanceTrend = java.util.List.of(
            java.util.Map.of("month", "Jan", "present", 95, "absent", 5),
            java.util.Map.of("month", "Feb", "present", 92, "absent", 8),
            java.util.Map.of("month", "Mar", "present", 97, "absent", 3)
        );
        java.util.Map<String, Long> leaveUtilization = java.util.Map.of("Sick Leave", 45L, "Casual Leave", 60L, "Earned Leave", 120L);
        java.util.List<java.util.Map<String, Object>> payrollCosts = java.util.List.of(
            java.util.Map.of("month", "Jan", "cost", 1500000),
            java.util.Map.of("month", "Feb", "cost", 1550000),
            java.util.Map.of("month", "Mar", "cost", 1520000)
        );

        return new ExecutiveDashboard(
                headcount, presentToday, pct, pendingApprovals, openTickets, assigned, inStock,
                departmentBreakdown, monthlyAttendanceTrend, leaveUtilization, payrollCosts);
    }
}
