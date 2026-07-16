package com.pixous.hrportal.modules.leave;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pixous.hrportal.common.ApiException;
import com.pixous.hrportal.common.PageResponse;
import com.pixous.hrportal.modules.leave.dto.BulkLeaveDecisionRequest;
import com.pixous.hrportal.modules.leave.dto.LeaveApplyRequest;
import com.pixous.hrportal.modules.leave.dto.LeaveBalanceResponse;
import com.pixous.hrportal.modules.leave.dto.LeaveDecisionRequest;
import com.pixous.hrportal.modules.leave.dto.LeaveRequestResponse;
import com.pixous.hrportal.modules.leave.dto.LeaveTypeRequest;
import com.pixous.hrportal.modules.leave.dto.LeaveTypeResponse;
import com.pixous.hrportal.modules.notification.NotificationService;
import com.pixous.hrportal.modules.org.Holiday;
import com.pixous.hrportal.modules.org.HolidayRepository;
import com.pixous.hrportal.modules.user.User;
import com.pixous.hrportal.modules.user.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class LeaveService {

    private final LeaveTypeRepository typeRepository;
    private final LeaveBalanceRepository balanceRepository;
    private final LeaveRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final HolidayRepository holidayRepository;
    private final NotificationService notificationService;

    // ---------- Reference data ----------

    @Transactional(readOnly = true)
    public List<LeaveTypeResponse> types() {
        return typeRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(LeaveTypeResponse::from).toList();
    }

    @Transactional
    public LeaveTypeResponse createType(LeaveTypeRequest req) {
        LeaveType t = new LeaveType();
        updateTypeFromReq(t, req);
        return LeaveTypeResponse.from(typeRepository.save(t));
    }

    @Transactional
    public LeaveTypeResponse updateType(Long id, LeaveTypeRequest req) {
        LeaveType t = typeRepository.findById(id).orElseThrow(() -> ApiException.notFound("Leave type"));
        updateTypeFromReq(t, req);
        return LeaveTypeResponse.from(typeRepository.save(t));
    }

    @Transactional
    public void deleteType(Long id) {
        LeaveType t = typeRepository.findById(id).orElseThrow(() -> ApiException.notFound("Leave type"));
        t.setActive(false);
        typeRepository.save(t);
    }

    private void updateTypeFromReq(LeaveType t, LeaveTypeRequest req) {
        t.setName(req.name());
        t.setCode(req.code());
        t.setMaxDaysPerYear(req.maxDaysPerYear());
        t.setCarryForward(req.carryForward());
        t.setEncashable(req.encashable());
        t.setGenderRestriction(
    req.genderRestriction() != null && !req.genderRestriction().isBlank()
        ? req.genderRestriction().charAt(0)
        : null
);
        t.setAllowPastDates(req.allowPastDates());
        t.setAccrualType(req.accrualType());
        t.setMinNoticeDays(req.minNoticeDays());
        t.setMonthlyLimit(req.monthlyLimit());
    }

    @Transactional(readOnly = true)
    public List<LeaveBalanceResponse> balances(Long userId, Integer year) {
        int y = year != null ? year : Year.now().getValue();
        Map<Long, LeaveType> typeMap = typeRepository.findAll().stream()
                .collect(Collectors.toMap(LeaveType::getId, t -> t));
        return balanceRepository.findByUserIdAndYear(userId, y).stream()
                .map(b -> {
                    LeaveType t = typeMap.get(b.getLeaveTypeId());
                    return new LeaveBalanceResponse(
                            b.getLeaveTypeId(),
                            t != null ? t.getName() : "?",
                            t != null ? t.getCode() : "?",
                            b.getYear(), b.getAllocated(), b.getUsed(), b.getAvailable());
                }).toList();
    }

    /**
     * One-click bulk allocation: give every enabled employee their annual leave
     * balance for {@code year}, using each active leave type's configured
     * "max days per year" as the allocated amount. Types with no cap or a zero
     * cap (e.g. LOP, Comp-Off) are skipped. Existing balances are left untouched
     * (never overwrites a used/allocated value), so it is safe to run repeatedly.
     *
     * @return how many new balance rows were created and how many employees were covered.
     */
    @Transactional
    public Map<String, Integer> allocateDefaultsToAll(Integer year) {
        int y = year != null ? year : Year.now().getValue();
        List<User> users = userRepository.findByEnabledTrue();
        List<LeaveType> types = typeRepository.findByActiveTrueOrderByNameAsc().stream()
                .filter(t -> t.getMaxDaysPerYear() != null && t.getMaxDaysPerYear() > 0)
                .toList();

        int created = 0;
        for (User u : users) {
            for (LeaveType t : types) {
                boolean exists = balanceRepository
                        .findByUserIdAndLeaveTypeIdAndYear(u.getId(), t.getId(), y)
                        .isPresent();
                if (exists) continue;
                LeaveBalance b = new LeaveBalance();
                b.setUserId(u.getId());
                b.setLeaveTypeId(t.getId());
                b.setYear(y);
                b.setAllocated(BigDecimal.valueOf(t.getMaxDaysPerYear()));
                b.setUsed(BigDecimal.ZERO);
                balanceRepository.save(b);
                created++;
            }
        }
        return Map.of("created", created, "employees", users.size(), "year", y);
    }

    // ---------- Apply ----------

    @Transactional
    public LeaveRequestResponse apply(Long userId, LeaveApplyRequest req) {
        if (req.toDate().isBefore(req.fromDate())) {
            throw ApiException.business("End date cannot be before start date");
        }
        LeaveType type = typeRepository.findById(req.leaveTypeId())
                .orElseThrow(() -> ApiException.notFound("Leave type"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User"));

        // Gender restriction (e.g. maternity = 'F')  [US-IT-EMP-03 AC3]
       if (type.getGenderRestriction() != null && user.getGender() != null) {
    String leaveGender = String.valueOf(type.getGenderRestriction()).toUpperCase();
    String userGender = String.valueOf(user.getGender()).toUpperCase();

    if (!leaveGender.equals(userGender)) {
        throw ApiException.business(type.getName() + " is not applicable for your profile");
    }
}

        // Past-date guard unless the type explicitly allows it (sick leave)
        if (!type.isAllowPastDates() && req.fromDate().isBefore(LocalDate.now())) {
            throw ApiException.business("This leave type cannot be applied for past dates");
        }

        // Note: the per-month cap for CL/SL is enforced below via
        // leave_types.monthly_limit + countMonthlyConsuming (1 CL + 1 SL / month).
        // A separate 3-month-gap rule used to live here; it contradicted the
        // monthly cap (blocking the 2nd allowed month) and has been removed.

        // Minimum-notice guard (civil min-notice rule)
        if (type.getMinNoticeDays() != null && type.getMinNoticeDays() > 0) {
            long noticeDays = LocalDate.now().until(req.fromDate()).getDays()
                    + LocalDate.now().until(req.fromDate()).getMonths() * 30L;
            if (req.fromDate().isAfter(LocalDate.now())
                    && noticeDays < type.getMinNoticeDays()) {
                throw ApiException.business(
                        type.getName() + " requires at least " + type.getMinNoticeDays() + " day(s) notice");
            }
        }

        BigDecimal workingDays = BigDecimal.valueOf(
                countWorkingDays(req.fromDate(), req.toDate()));
        if (workingDays.signum() <= 0) {
            throw ApiException.business("Selected range has no working days");
        }

        // Monthly cap (e.g. 1 casual + 1 sick per calendar month). [Employee rule]
        if (type.getMonthlyLimit() != null && type.getMonthlyLimit() > 0) {
            long alreadyThisMonth = requestRepository.countMonthlyConsuming(
                    userId, type.getId(),
                    req.fromDate().getYear(), req.fromDate().getMonthValue());
            if (alreadyThisMonth >= type.getMonthlyLimit()) {
                throw ApiException.business(
                        "No " + type.getName() + " left: you have already used your "
                                + type.getMonthlyLimit() + " " + type.getName()
                                + " for this month");
            }
        }

        // Balance check (LOP-type leaves have no allocation and are skipped)
        int year = req.fromDate().getYear();
        if (!"LOP".equalsIgnoreCase(type.getCode())) {
            LeaveBalance balance = balanceRepository
                    .findByUserIdAndLeaveTypeIdAndYear(userId, type.getId(), year)
                    .orElse(null);
            if (balance == null) {
                throw ApiException.business("No leave balance allocated for " + type.getName());
            }
            if (balance.getAvailable().compareTo(workingDays) < 0) {
                throw ApiException.business("Insufficient balance: available "
                        + balance.getAvailable() + ", requested " + workingDays);
            }
        }

        LeaveRequest lr = new LeaveRequest();
        lr.setUserId(userId);
        lr.setLeaveTypeId(type.getId());
        lr.setFromDate(req.fromDate());
        lr.setToDate(req.toDate());
        lr.setWorkingDays(workingDays);
        lr.setReason(req.reason());
        lr.setAttachmentPath(req.attachmentPath());
        lr.setStatus("PENDING");
        LeaveRequest saved = requestRepository.save(lr);

        // Route to Admin only: notify every admin who can approve leave. The
        // request is confirmed only once an admin approves it.
        String label = type.getName() + " (" + workingDays + " day(s))";
        for (User admin : userRepository.findByPermission("LEAVE_APPROVE")) {
            notificationService.createAndPush(
                    admin.getId(),
                    "Leave request pending",
                    user.getName() + " applied for " + label,
                    "LEAVE",
                    "/leave/approvals");
        }
        return LeaveRequestResponse.from(saved, user.getName(), type.getName());
    }

    @Transactional(readOnly = true)
    public PageResponse<LeaveRequestResponse> myRequests(Long userId, int page, int size) {
        Map<Long, String> typeNames = typeNameMap();
        String name = userRepository.findById(userId).map(User::getName).orElse("?");
        Page<LeaveRequestResponse> result = requestRepository
                .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size))
                .map(r -> LeaveRequestResponse.from(r, name,
                        typeNames.getOrDefault(r.getLeaveTypeId(), "?")));
        return PageResponse.from(result);
    }

    @Transactional
    public void cancel(Long userId, Long requestId) {
        LeaveRequest lr = requestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("Leave request"));
        if (!lr.getUserId().equals(userId)) {
            throw ApiException.business("You can only cancel your own request");
        }
        if (!"PENDING".equals(lr.getStatus()) && !"APPROVED".equals(lr.getStatus())) {
            throw ApiException.business("Only pending or approved leave can be cancelled");
        }
        // Refund balance if it had been approved (and deducted)
        if ("APPROVED".equals(lr.getStatus())) {
            refundBalance(lr);
        }
        lr.setStatus("CANCELLED");
        lr.setUpdatedAt(LocalDateTime.now());
    }

    // ---------- Manager inbox + decisions ----------

    @Transactional(readOnly = true)
    public List<LeaveRequestResponse> pendingForManager(Long managerId) {
        Map<Long, String> typeNames = typeNameMap();

        // Admins (USER_MANAGE) approve everyone's leave; regular approvers see
        // only their own direct reports. Since all leave routes to Admin, the
        // admin inbox is the authoritative approval queue.
        boolean isAdmin = com.pixous.hrportal.security.SecurityUtils.hasAuthority("USER_MANAGE");
        if (isAdmin) {
            List<LeaveRequest> all = requestRepository.findAllPending();
            Map<Long, String> nameById = userRepository.findAllById(
                            all.stream().map(LeaveRequest::getUserId).distinct().toList())
                    .stream().collect(Collectors.toMap(User::getId, User::getName));
            return all.stream()
                    .map(r -> LeaveRequestResponse.from(r,
                            nameById.getOrDefault(r.getUserId(), "?"),
                            typeNames.getOrDefault(r.getLeaveTypeId(), "?")))
                    .toList();
        }

        List<User> reports = userRepository.findByReportingManagerId(managerId);
        if (reports.isEmpty()) return List.of();
        Map<Long, String> nameById = reports.stream()
                .collect(Collectors.toMap(User::getId, User::getName));
        List<Long> reportIds = new ArrayList<>(nameById.keySet());
        return requestRepository.findPendingForUsers(reportIds).stream()
                .map(r -> LeaveRequestResponse.from(r,
                        nameById.getOrDefault(r.getUserId(), "?"),
                        typeNames.getOrDefault(r.getLeaveTypeId(), "?")))
                .toList();
    }

    /** Everyone currently on approved leave (today falls within their from..to). */
    @Transactional(readOnly = true)
    public List<LeaveRequestResponse> onLeaveToday() {
        Map<Long, String> typeNames = typeNameMap();
        List<LeaveRequest> all = requestRepository.findOnLeave(java.time.LocalDate.now());
        Map<Long, String> nameById = userRepository.findAllById(
                        all.stream().map(LeaveRequest::getUserId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, User::getName));
        return all.stream()
                .map(r -> LeaveRequestResponse.from(r,
                        nameById.getOrDefault(r.getUserId(), "?"),
                        typeNames.getOrDefault(r.getLeaveTypeId(), "?")))
                .toList();
    }

    @Transactional
    public LeaveRequestResponse decide(Long managerId, Long requestId, LeaveDecisionRequest req) {
        LeaveRequest lr = requestRepository.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("Leave request"));
        return applyDecision(managerId, lr, req.decision(), req.comment());
    }

    @Transactional
    public int bulkDecide(Long managerId, BulkLeaveDecisionRequest req) {
        int count = 0;
        for (Long id : req.requestIds()) {
            LeaveRequest lr = requestRepository.findById(id).orElse(null);
            if (lr != null && "PENDING".equals(lr.getStatus())) {
                applyDecision(managerId, lr, req.decision(), req.comment());
                count++;
            }
        }
        return count;
    }

    private LeaveRequestResponse applyDecision(Long managerId, LeaveRequest lr,
                                               String decision, String comment) {
        if (!"PENDING".equals(lr.getStatus())) {
            throw ApiException.business("Request already " + lr.getStatus().toLowerCase());
        }
        String normalized = decision == null ? "" : decision.trim().toUpperCase();
        if (!normalized.equals("APPROVED") && !normalized.equals("REJECTED")) {
            throw ApiException.business("Decision must be APPROVED or REJECTED");
        }

        LeaveType type = typeRepository.findById(lr.getLeaveTypeId()).orElse(null);
        if (normalized.equals("APPROVED") && type != null
                && !"LOP".equalsIgnoreCase(type.getCode())) {
            LeaveBalance balance = balanceRepository
                    .findByUserIdAndLeaveTypeIdAndYear(lr.getUserId(), lr.getLeaveTypeId(),
                            lr.getFromDate().getYear())
                    .orElseThrow(() -> ApiException.business("Balance record missing"));
            if (balance.getAvailable().compareTo(lr.getWorkingDays()) < 0) {
                throw ApiException.business("Employee no longer has sufficient balance");
            }
            balance.setUsed(balance.getUsed().add(lr.getWorkingDays()));
        }

        lr.setStatus(normalized);
        lr.setDecidedBy(managerId);
        lr.setDecidedAt(LocalDateTime.now());
        lr.setDecisionComment(comment);
        lr.setUpdatedAt(LocalDateTime.now());

        String typeName = type != null ? type.getName() : "leave";
        notificationService.createAndPush(
                lr.getUserId(),
                "Leave " + normalized.toLowerCase(),
                "Your " + typeName + " request (" + lr.getFromDate() + " to "
                        + lr.getToDate() + ") was " + normalized.toLowerCase(),
                "LEAVE",
                "/leave");

        String empName = userRepository.findById(lr.getUserId()).map(User::getName).orElse("?");
        return LeaveRequestResponse.from(lr, empName, typeName);
    }

    private void refundBalance(LeaveRequest lr) {
        LeaveType type = typeRepository.findById(lr.getLeaveTypeId()).orElse(null);
        if (type != null && !"LOP".equalsIgnoreCase(type.getCode())) {
            balanceRepository.findByUserIdAndLeaveTypeIdAndYear(
                            lr.getUserId(), lr.getLeaveTypeId(), lr.getFromDate().getYear())
                    .ifPresent(b -> b.setUsed(
                            b.getUsed().subtract(lr.getWorkingDays()).max(BigDecimal.ZERO)));
        }
    }

    // ---------- Helpers ----------

    /** Counts weekdays in [from, to] excluding Sat/Sun and configured holidays. [AC9] */
    private long countWorkingDays(LocalDate from, LocalDate to) {
        Set<LocalDate> holidays = holidayRepository
                .findByHolidayDateBetweenOrderByHolidayDateAsc(from, to).stream()
                .map(Holiday::getHolidayDate).collect(Collectors.toSet());
        long days = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            DayOfWeek dow = d.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) continue;
            if (holidays.contains(d)) continue;
            days++;
        }
        return days;
    }

    private Map<Long, String> typeNameMap() {
        return typeRepository.findAll().stream()
                .collect(Collectors.toMap(LeaveType::getId, LeaveType::getName));
    }
}
