package com.pixous.hrportal.modules.complaint.dto;

import com.pixous.hrportal.modules.complaint.ComplaintNeed;

import java.time.LocalDateTime;

/** View returned to clients. Includes submitter/handler display names. */
public record ComplaintResponse(
        Long id,
        String referenceCode,
        Long raisedBy,
        String raisedByName,
        String kind,
        String category,
        String subject,
        String description,
        String priority,
        String status,
        String hrResponse,
        Long handledBy,
        String handledByName,
        LocalDateTime resolvedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static ComplaintResponse from(ComplaintNeed c, String raisedByName, String handledByName) {
        return new ComplaintResponse(
                c.getId(),
                c.getReferenceCode(),
                c.getRaisedBy(),
                raisedByName,
                c.getKind(),
                c.getCategory(),
                c.getSubject(),
                c.getDescription(),
                c.getPriority(),
                c.getStatus(),
                c.getHrResponse(),
                c.getHandledBy(),
                handledByName,
                c.getResolvedAt(),
                c.getCreatedAt(),
                c.getUpdatedAt()
        );
    }
}
