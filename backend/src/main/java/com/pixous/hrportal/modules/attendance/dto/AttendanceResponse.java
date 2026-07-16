package com.pixous.hrportal.modules.attendance.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record AttendanceResponse(
        Long id,
        Long userId,
        LocalDate workDate,
        LocalDateTime punchInAt,
        LocalDateTime punchOutAt,
        String mode,
        String status,
        boolean late,
        Boolean withinGeofence,
        boolean geofenceException,
        Integer workedMinutes,
        Integer overtimeMinutes,
        BigDecimal inLatitude,
        BigDecimal inLongitude,
        BigDecimal outLatitude,
        BigDecimal outLongitude
) {}
