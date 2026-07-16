package com.pixous.hrportal.modules.leave.dto;

import com.pixous.hrportal.modules.leave.LeaveRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record LeaveRequestResponse(
        Long id, Long userId, String employeeName, Long leaveTypeId, String leaveTypeName,
        LocalDate fromDate, LocalDate toDate, BigDecimal workingDays, String reason,
        String attachmentPath, String status, Long decidedBy, LocalDateTime decidedAt,
        String decisionComment, LocalDateTime createdAt
) {
    public static LeaveRequestResponse from(LeaveRequest r, String employeeName, String leaveTypeName) {
        return new LeaveRequestResponse(r.getId(), r.getUserId(), employeeName,
                r.getLeaveTypeId(), leaveTypeName, r.getFromDate(), r.getToDate(),
                r.getWorkingDays(), r.getReason(), r.getAttachmentPath(), r.getStatus(),
                r.getDecidedBy(), r.getDecidedAt(), r.getDecisionComment(), r.getCreatedAt());
    }
}
