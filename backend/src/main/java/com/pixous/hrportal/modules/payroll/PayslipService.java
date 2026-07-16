package com.pixous.hrportal.modules.payroll;

import com.pixous.hrportal.common.ApiException;
import com.pixous.hrportal.modules.attendance.AttendanceRepository;
import com.pixous.hrportal.modules.org.Holiday;
import com.pixous.hrportal.modules.org.HolidayRepository;
import com.pixous.hrportal.modules.payroll.dto.*;
import com.pixous.hrportal.modules.user.User;
import com.pixous.hrportal.modules.user.UserRepository;
import lombok.RequiredArgsConstructor;
import com.pixous.hrportal.modules.notification.NotificationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Payslip generation. Mirrors the legacy PHP contract
 * (payslip/index.php action=generate|list) with components
 * basic_salary / hra / allowances / deductions, extended with
 * statutory PF / ESI / PT and attendance-driven LOP.
 */
@Service
@RequiredArgsConstructor
public class PayslipService {

    private static final BigDecimal ESI_WAGE_CEILING = new BigDecimal("21000");
    private static final BigDecimal ESI_RATE = new BigDecimal("0.0075"); // 0.75% employee share
    private static final BigDecimal OT_HOURLY_DIVISOR = new BigDecimal("240"); // ~30 days * 8h

    private final SalaryStructureRepository salaryRepository;
    private final PayslipRepository payslipRepository;
    private final UserRepository userRepository;
    private final AttendanceRepository attendanceRepository;
    private final HolidayRepository holidayRepository;
    private final ReportService reportService;
    private final PayrollRunRepository payrollRunRepository;
    private final NotificationService notificationService;

    @Transactional
    public PayslipResponse generate(GeneratePayslipRequest req) {
        User user = userRepository.findById(req.userId())
                .orElseThrow(() -> ApiException.notFound("User"));

        // Cannot generate a payslip for a month before the employee joined.
        if (user.getDateOfJoining() != null) {
            java.time.YearMonth requested = java.time.YearMonth.of(req.year(), req.month());
            java.time.YearMonth joined = java.time.YearMonth.from(user.getDateOfJoining());
            if (requested.isBefore(joined)) {
                throw ApiException.business(
                        user.getName() + " was not working before the joining date ("
                                + user.getDateOfJoining() + "). Choose a month on or after "
                                + joined.getMonth() + " " + joined.getYear() + ".");
            }
        }

        SalaryStructure salary = salaryRepository.findByUserIdAndActiveTrue(req.userId())
                .orElseThrow(() -> ApiException.business(
                        "No active salary structure for " + user.getName()));

        Payslip p = payslipRepository
                .findByUserIdAndPayMonthAndPayYear(req.userId(), req.month(), req.year())
                .orElseGet(Payslip::new);
        p.setUserId(req.userId());
        p.setPayMonth(req.month());
        p.setPayYear(req.year());

        // ---- Earnings ----
        BigDecimal basic = salary.getBasicSalary();
        BigDecimal hra = salary.getHra();
        BigDecimal allowances = salary.getAllowances();

        BigDecimal perDayGross = basic.add(hra).add(allowances)
                .divide(BigDecimal.valueOf(daysInMonth(req.month(), req.year())), 2, RoundingMode.HALF_UP);

        // Overtime pay = hourly rate * OT hours
        BigDecimal otHours = BigDecimal.valueOf(
                req.overtimeHours() != null ? req.overtimeHours() : 0.0);
        BigDecimal hourlyRate = basic.add(hra).add(allowances)
                .divide(OT_HOURLY_DIVISOR, 2, RoundingMode.HALF_UP);
        BigDecimal overtimePay = hourlyRate.multiply(otHours).setScale(2, RoundingMode.HALF_UP);

        // ---- LOP (attendance driven) ----
        BigDecimal lopDays = BigDecimal.valueOf(
                computeLopDays(req.userId(), req.month(), req.year()));
        BigDecimal lopAmount = perDayGross.multiply(lopDays).setScale(2, RoundingMode.HALF_UP);

        BigDecimal gross = basic.add(hra).add(allowances).add(overtimePay)
                .subtract(lopAmount).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);

        // ---- Deductions ----
        BigDecimal pf = basic.multiply(salary.getPfPercentage())
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        BigDecimal esi = BigDecimal.ZERO;
        if (salary.isEsiApplicable() && gross.compareTo(ESI_WAGE_CEILING) <= 0) {
            esi = gross.multiply(ESI_RATE).setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal pt = salary.getPtAmount();
        BigDecimal tds = BigDecimal.valueOf(req.tds() != null ? req.tds() : 0.0)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal otherDed = BigDecimal.valueOf(req.otherDeductions() != null ? req.otherDeductions() : 0.0)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal totalDed = pf.add(esi).add(pt).add(tds).add(otherDed)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal net = gross.subtract(totalDed).setScale(2, RoundingMode.HALF_UP);

        p.setBasicSalary(basic);
        p.setHra(hra);
        p.setAllowances(allowances);
        p.setOvertimePay(overtimePay);
        p.setGrossSalary(gross);
        p.setPfDeduction(pf);
        p.setEsiDeduction(esi);
        p.setPtDeduction(pt);
        p.setTdsDeduction(tds);
        p.setOtherDeductions(otherDed);
        p.setTotalDeductions(totalDed);
        p.setNetPay(net);
        p.setLopDays(lopDays);

        Payslip saved = payslipRepository.save(p);

        // Render PDF and persist its path
        String pdfPath = reportService.renderPayslipPdf(saved, user);
        saved.setPdfPath(pdfPath);

        return PayslipResponse.from(saved, user.getName(), user.getEmployeeCode());
    }

    @Transactional(readOnly = true)
    public List<PayslipSummary> list(Long userId) {
        return payslipRepository.findByUserIdOrderByPayYearDescPayMonthDesc(userId).stream()
                .map(PayslipSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public PayslipResponse get(Long requesterId, Long payslipId, boolean privileged) {
        Payslip p = payslipRepository.findById(payslipId)
                .orElseThrow(() -> ApiException.notFound("Payslip"));
        if (!privileged && !p.getUserId().equals(requesterId)) {
            throw ApiException.business("You can only view your own payslips");
        }
        User u = userRepository.findById(p.getUserId()).orElse(null);
        return PayslipResponse.from(p,
                u != null ? u.getName() : "?",
                u != null ? u.getEmployeeCode() : "?");
    }

    @Transactional
    public PayrollRunResponse generateBatch(int month, int year, Long runBy) {
        if (payrollRunRepository.findByPayMonthAndPayYear(month, year).isPresent()) {
            throw ApiException.business("Payroll run for this month already exists");
        }
        
        PayrollRun run = new PayrollRun();
        run.setPayMonth(month);
        run.setPayYear(year);
        run.setRunBy(runBy);
        run.setRunAt(java.time.LocalDateTime.now());
        run.setStatus("PREVIEW");
        PayrollRun savedRun = payrollRunRepository.save(run);

        List<User> activeUsers = userRepository.findByEnabledTrue();
        for (User u : activeUsers) {
            try {
                GeneratePayslipRequest req = new GeneratePayslipRequest(u.getId(), month, year, 0.0, 0.0, 0.0);
                PayslipResponse resp = generate(req);
                Payslip p = payslipRepository.findById(resp.id()).orElseThrow();
                p.setPayrollRunId(savedRun.getId());
                payslipRepository.save(p);
            } catch (Exception e) {
                // skip users without active salary structures etc.
            }
        }
        return getRun(savedRun.getId());
    }

    @Transactional
    public PayrollRunResponse confirmRun(Long runId, Long runBy) {
        PayrollRun run = payrollRunRepository.findById(runId)
                .orElseThrow(() -> ApiException.notFound("Payroll run"));
        if (!"PREVIEW".equals(run.getStatus())) {
            throw ApiException.business("Run is not in PREVIEW state");
        }
        run.setStatus("CONFIRMED");
        payrollRunRepository.save(run);
        return getRun(runId);
    }

    @Transactional
    public PayrollRunResponse financeApproveRun(Long runId, Long approvedBy) {
        PayrollRun run = payrollRunRepository.findById(runId)
                .orElseThrow(() -> ApiException.notFound("Payroll run"));
        if (!"CONFIRMED".equals(run.getStatus())) {
            throw ApiException.business("Run is not in CONFIRMED state");
        }
        run.setStatus("FINANCE_APPROVED");
        run.setFinanceApprovedBy(approvedBy);
        run.setFinanceApprovedAt(java.time.LocalDateTime.now());
        payrollRunRepository.save(run);

        // Notify all employees
        List<Payslip> slips = payslipRepository.findByPayrollRunId(runId);
        for (Payslip p : slips) {
            notificationService.createAndPush(
                    p.getUserId(),
                    "Payslip Available",
                    "Your payslip for " + java.time.Month.of(run.getPayMonth()) + " " + run.getPayYear() + " is ready.",
                    "PAYROLL",
                    "/payslips"
            );
        }
        return getRun(runId);
    }

    @Transactional(readOnly = true)
    public List<PayrollRunSummary> listRuns() {
        return payrollRunRepository.findAll().stream()
                .sorted((a, b) -> {
                    if (a.getPayYear() != b.getPayYear()) return b.getPayYear() - a.getPayYear();
                    return b.getPayMonth() - a.getPayMonth();
                })
                .map(PayrollRunSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public PayrollRunResponse getRun(Long runId) {
        PayrollRun run = payrollRunRepository.findById(runId)
                .orElseThrow(() -> ApiException.notFound("Payroll run"));
        List<PayslipResponse> slips = payslipRepository.findByPayrollRunId(runId).stream()
                .map(p -> {
                    User u = userRepository.findById(p.getUserId()).orElse(null);
                    return PayslipResponse.from(p, u != null ? u.getName() : "?", u != null ? u.getEmployeeCode() : "?");
                }).toList();
        return PayrollRunResponse.from(run, slips);
    }

    @Transactional(readOnly = true)
    public byte[] pdfBytes(Long requesterId, Long payslipId, boolean privileged) {
        Payslip p = payslipRepository.findById(payslipId)
                .orElseThrow(() -> ApiException.notFound("Payslip"));
        if (!privileged && !p.getUserId().equals(requesterId)) {
            throw ApiException.business("You can only download your own payslips");
        }
        User u = userRepository.findById(p.getUserId())
                .orElseThrow(() -> ApiException.notFound("User"));
        if (p.getPdfPath() != null) {
            try {
                return reportService.read(p.getPdfPath());
            } catch (Exception ignored) {
                // fall through and regenerate
            }
        }
        return reportService.payslipPdfBytes(p, u);
    }

    // ---- helpers ----

    private int daysInMonth(int month, int year) {
        return YearMonth.of(year, month).lengthOfMonth();
    }

    /** Working days in the month with neither attendance nor approved leave. */
    private long computeLopDays(Long userId, int month, int year) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();
        // do not count future days within the current month
        LocalDate today = LocalDate.now();
        if (end.isAfter(today)) end = today;
        if (end.isBefore(start)) return 0;

        Set<LocalDate> holidays = holidayRepository
                .findByHolidayDateBetweenOrderByHolidayDateAsc(start, end).stream()
                .map(Holiday::getHolidayDate).collect(Collectors.toSet());

        Set<LocalDate> presentDays = attendanceRepository
                .findByUserIdAndWorkDateBetweenOrderByWorkDateDesc(userId, start, end).stream()
                .filter(a -> a.getPunchInAt() != null)
                .map(a -> a.getWorkDate()).collect(Collectors.toSet());

        long lop = 0;
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            DayOfWeek dow = d.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) continue;
            if (holidays.contains(d)) continue;
            if (presentDays.contains(d)) continue;
            lop++;
        }
        return lop;
    }
}
