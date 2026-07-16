package com.pixous.hrportal.modules.attendance.dto;

public record AttendanceSummary(
        int month,
        int year,
        long presentDays,
        long wfhDays,
        long lateDays,
        long absentDays,
        int totalOvertimeMinutes
) {}
