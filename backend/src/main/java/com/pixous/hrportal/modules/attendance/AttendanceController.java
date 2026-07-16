package com.pixous.hrportal.modules.attendance;

import com.pixous.hrportal.common.ApiResponse;
import com.pixous.hrportal.modules.attendance.dto.AttendanceResponse;
import com.pixous.hrportal.modules.attendance.dto.AttendanceSummary;
import com.pixous.hrportal.modules.attendance.dto.PunchRequest;
import com.pixous.hrportal.modules.user.User;
import com.pixous.hrportal.modules.user.UserRepository;
import com.pixous.hrportal.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/attendance")
@Tag(name = "Attendance", description = "GPS punch in/out, calendar, monthly summary, team view")
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final UserRepository userRepository;

    public AttendanceController(AttendanceService attendanceService,
                                UserRepository userRepository) {
        this.attendanceService = attendanceService;
        this.userRepository = userRepository;
    }

    @PostMapping("/punch-in")
    @Operation(summary = "Punch in (with GPS coordinates)")
    public ApiResponse<AttendanceResponse> punchIn(@RequestBody PunchRequest request) {
        return ApiResponse.ok(attendanceService.punchIn(SecurityUtils.currentUserId(), request),
                "Punched in");
    }

    @PostMapping("/punch-out")
    @Operation(summary = "Punch out (with GPS coordinates)")
    public ApiResponse<AttendanceResponse> punchOut(@RequestBody PunchRequest request) {
        return ApiResponse.ok(attendanceService.punchOut(SecurityUtils.currentUserId(), request),
                "Punched out");
    }

    @GetMapping("/today")
    @Operation(summary = "Today's attendance record for the signed-in user")
    public ApiResponse<AttendanceResponse> today() {
        return ApiResponse.ok(attendanceService.today(SecurityUtils.currentUserId()));
    }

    @GetMapping("/me")
    @Operation(summary = "Attendance calendar between two dates")
    public ApiResponse<List<AttendanceResponse>> myCalendar(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ApiResponse.ok(attendanceService.myCalendar(SecurityUtils.currentUserId(), from, to));
    }

    @GetMapping("/me/summary")
    @Operation(summary = "Monthly attendance summary (present/wfh/late/absent/overtime)")
    public ApiResponse<AttendanceSummary> summary(
            @RequestParam int month, @RequestParam int year) {
        return ApiResponse.ok(attendanceService.summary(SecurityUtils.currentUserId(), month, year));
    }

    @GetMapping("/team")
    @PreAuthorize("hasAnyAuthority('ATTENDANCE_TEAM','USER_MANAGE','DASHBOARD_EXEC')")
    @Operation(summary = "Team attendance for a given date (direct reports)")
    public ApiResponse<List<AttendanceResponse>> team(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate target = date == null ? LocalDate.now() : date;
        Long managerId = SecurityUtils.currentUserId();
        List<Long> memberIds;
        if (SecurityUtils.hasAuthority("USER_MANAGE") || SecurityUtils.hasAuthority("ATTENDANCE_TEAM") || SecurityUtils.hasAuthority("DASHBOARD_EXEC")) {
            memberIds = userRepository.findAll().stream().map(User::getId).toList();
        } else {
            memberIds = userRepository.findByReportingManagerId(managerId)
                    .stream().map(User::getId).toList();
        }
        return ApiResponse.ok(attendanceService.teamForDate(memberIds, target));
    }
}
