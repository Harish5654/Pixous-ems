package com.pixous.hrportal.modules.attendance;

import com.pixous.hrportal.common.ApiException;
import com.pixous.hrportal.common.ErrorCode;
import com.pixous.hrportal.config.AppProperties;
import com.pixous.hrportal.modules.attendance.dto.AttendanceResponse;
import com.pixous.hrportal.modules.attendance.dto.AttendanceSummary;
import com.pixous.hrportal.modules.attendance.dto.PunchRequest;
import com.pixous.hrportal.modules.org.OfficeLocation;
import com.pixous.hrportal.modules.org.OfficeLocationRepository;
import com.pixous.hrportal.modules.org.Shift;
import com.pixous.hrportal.modules.org.ShiftRepository;
import com.pixous.hrportal.modules.org.Site;
import com.pixous.hrportal.modules.org.SiteRepository;
import com.pixous.hrportal.modules.user.User;
import com.pixous.hrportal.modules.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Punch-in / punch-out with GPS geofence validation, late detection and
 * overtime calculation. WFH punches skip the geofence; office/site punches are
 * validated against the relevant location radius and flagged if outside.
 */
@Service
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final UserRepository userRepository;
    private final SiteRepository siteRepository;
    private final OfficeLocationRepository officeLocationRepository;
    private final ShiftRepository shiftRepository;
    private final GeofenceService geofenceService;
    private final AppProperties props;

    public AttendanceService(AttendanceRepository attendanceRepository,
                             UserRepository userRepository,
                             SiteRepository siteRepository,
                             OfficeLocationRepository officeLocationRepository,
                             ShiftRepository shiftRepository,
                             GeofenceService geofenceService,
                             AppProperties props) {
        this.attendanceRepository = attendanceRepository;
        this.userRepository = userRepository;
        this.siteRepository = siteRepository;
        this.officeLocationRepository = officeLocationRepository;
        this.shiftRepository = shiftRepository;
        this.geofenceService = geofenceService;
        this.props = props;
    }

    @Transactional
    public AttendanceResponse punchIn(Long userId, PunchRequest req) {
        LocalDate today = LocalDate.now();
        attendanceRepository.findByUserIdAndWorkDate(userId, today).ifPresent(a -> {
            if (a.getPunchInAt() != null) {
                throw ApiException.business("You have already punched in today");
            }
        });

        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User"));

        String mode = req.mode() == null ? "OFFICE" : req.mode().toUpperCase();
        Attendance attendance = attendanceRepository.findByUserIdAndWorkDate(userId, today)
                .orElseGet(Attendance::new);
        attendance.setUserId(userId);
        attendance.setWorkDate(today);
        attendance.setPunchInAt(LocalDateTime.now());
        attendance.setMode(mode);
        attendance.setInLatitude(req.latitude());
        attendance.setInLongitude(req.longitude());
        attendance.setShiftId(req.shiftId());

        if ("WFH".equals(mode)) {
            attendance.setStatus("WFH");
            attendance.setWithinGeofence(null);
        } else {
            evaluateGeofence(attendance, user, req, mode);
            attendance.setStatus("PRESENT");
        }

        attendance.setLate(evaluateLate(req.shiftId(), attendance.getPunchInAt()));
        attendanceRepository.save(attendance);
        return toResponse(attendance);
    }

    @Transactional
    public AttendanceResponse punchOut(Long userId, PunchRequest req) {
        LocalDate today = LocalDate.now();
        Attendance attendance = attendanceRepository.findByUserIdAndWorkDate(userId, today)
                .orElseThrow(() -> ApiException.business("Punch-in not found for today"));
        if (attendance.getPunchInAt() == null) {
            throw ApiException.business("You must punch in before punching out");
        }
        if (attendance.getPunchOutAt() != null) {
            throw ApiException.business("You have already punched out today");
        }

        attendance.setPunchOutAt(LocalDateTime.now());
        attendance.setOutLatitude(req.latitude());
        attendance.setOutLongitude(req.longitude());

        int worked = (int) Duration.between(attendance.getPunchInAt(),
                attendance.getPunchOutAt()).toMinutes();
        attendance.setWorkedMinutes(Math.max(worked, 0));

        int standardMinutes = props.attendance().standardWorkHours() * 60;
        attendance.setOvertimeMinutes(Math.max(worked - standardMinutes, 0));

        attendanceRepository.save(attendance);
        return toResponse(attendance);
    }

    @Transactional(readOnly = true)
    public AttendanceResponse today(Long userId) {
        return attendanceRepository.findByUserIdAndWorkDate(userId, LocalDate.now())
                .map(this::toResponse)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<AttendanceResponse> myCalendar(Long userId, LocalDate from, LocalDate to) {
        return attendanceRepository
                .findByUserIdAndWorkDateBetweenOrderByWorkDateDesc(userId, from, to)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AttendanceSummary summary(Long userId, int month, int year) {
        LocalDate from = LocalDate.of(year, month, 1);
        LocalDate to = from.withDayOfMonth(from.lengthOfMonth());
        List<Attendance> records = attendanceRepository
                .findByUserIdAndWorkDateBetweenOrderByWorkDateDesc(userId, from, to);
        long present = records.stream().filter(a -> "PRESENT".equals(a.getStatus())).count();
        long wfh = records.stream().filter(a -> "WFH".equals(a.getStatus())).count();
        long late = records.stream().filter(Attendance::isLate).count();
        int overtime = records.stream()
                .mapToInt(a -> a.getOvertimeMinutes() == null ? 0 : a.getOvertimeMinutes()).sum();
        LocalDate today = LocalDate.now();
        int workingDays;
        if (today.getYear() == year && today.getMonthValue() == month) {
            workingDays = today.getDayOfMonth();
        } else if (today.isBefore(from)) {
            workingDays = 0;
        } else {
            workingDays = to.getDayOfMonth();
        }
        long absent = Math.max(0, workingDays - present - wfh);
        return new AttendanceSummary(month, year, present, wfh, late, absent, overtime);
    }

    @Transactional(readOnly = true)
    public List<AttendanceResponse> teamForDate(List<Long> memberIds, LocalDate date) {
        return attendanceRepository.findByWorkDate(date).stream()
                .filter(a -> memberIds.contains(a.getUserId()))
                .map(this::toResponse)
                .toList();
    }

    // ---- helpers ----

    private void evaluateGeofence(Attendance attendance, User user, PunchRequest req, String mode) {
        boolean within = false;
        if ("SITE".equals(mode)) {
            Long siteId = req.siteId() != null ? req.siteId() : user.getSiteId();
            if (siteId != null) {
                Site site = siteRepository.findById(siteId).orElse(null);
                if (site != null) {
                    attendance.setSiteId(site.getId());
                    int radius = site.getGeofenceRadiusMetres() == null
                            ? props.attendance().defaultGeofenceRadiusMetres()
                            : site.getGeofenceRadiusMetres();
                    within = geofenceService.isWithin(req.latitude(), req.longitude(),
                            site.getLatitude(), site.getLongitude(), radius);
                }
            }
        } else { // OFFICE / BIOMETRIC
            Long locId = req.officeLocationId() != null
                    ? req.officeLocationId() : user.getOfficeLocationId();
            if (locId != null) {
                OfficeLocation loc = officeLocationRepository.findById(locId).orElse(null);
                if (loc != null) {
                    int radius = loc.getGeofenceRadiusMetres() == null
                            ? props.attendance().defaultGeofenceRadiusMetres()
                            : loc.getGeofenceRadiusMetres();
                    within = geofenceService.isWithin(req.latitude(), req.longitude(),
                            loc.getLatitude(), loc.getLongitude(), radius);
                }
            }
        }
        attendance.setWithinGeofence(within);
        attendance.setGeofenceException(!within);
    }

    private boolean evaluateLate(Long shiftId, LocalDateTime punchInAt) {
        if (shiftId == null) {
            return false;
        }
        Shift shift = shiftRepository.findById(shiftId).orElse(null);
        if (shift == null || shift.getStartTime() == null) {
            return false;
        }
        LocalDateTime allowedUntil = punchInAt.toLocalDate()
                .atTime(shift.getStartTime())
                .plusMinutes(props.attendance().lateGraceMinutes());
        return punchInAt.isAfter(allowedUntil);
    }

    private AttendanceResponse toResponse(Attendance a) {
        return new AttendanceResponse(a.getId(), a.getUserId(), a.getWorkDate(),
                a.getPunchInAt(), a.getPunchOutAt(), a.getMode(), a.getStatus(),
                a.isLate(), a.getWithinGeofence(), a.isGeofenceException(),
                a.getWorkedMinutes(), a.getOvertimeMinutes(),
                a.getInLatitude(), a.getInLongitude(),
                a.getOutLatitude(), a.getOutLongitude());
    }
}
