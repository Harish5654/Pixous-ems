package com.pixous.hrportal.modules.complaint;

import com.pixous.hrportal.common.ApiException;
import com.pixous.hrportal.common.PageResponse;
import com.pixous.hrportal.modules.complaint.dto.ComplaintDecisionRequest;
import com.pixous.hrportal.modules.complaint.dto.ComplaintRequest;
import com.pixous.hrportal.modules.complaint.dto.ComplaintResponse;
import com.pixous.hrportal.modules.notification.NotificationService;
import com.pixous.hrportal.modules.user.User;
import com.pixous.hrportal.modules.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.Year;
import java.util.List;
import java.util.Set;

/** Complaints / Needs: employees & managers submit; HR/Admin review and respond. */
@Service
@RequiredArgsConstructor
public class ComplaintService {

    private static final Set<String> VALID_KIND = Set.of("COMPLAINT", "NEED");
    private static final Set<String> VALID_PRIORITY = Set.of("LOW", "MEDIUM", "HIGH");
    private static final Set<String> VALID_STATUS =
            Set.of("OPEN", "IN_REVIEW", "RESOLVED", "REJECTED");

    private final ComplaintNeedRepository repository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public ComplaintResponse submit(Long userId, ComplaintRequest req) {
        ComplaintNeed c = new ComplaintNeed();
        c.setReferenceCode(generateCode());
        c.setRaisedBy(userId);
        c.setKind(normalise(req.kind(), VALID_KIND, "COMPLAINT"));
        c.setCategory(blankToNull(req.category()));
        c.setSubject(req.subject().trim());
        c.setDescription(req.description().trim());
        c.setPriority(normalise(req.priority(), VALID_PRIORITY, "MEDIUM"));
        c.setStatus("OPEN");
        ComplaintNeed saved = repository.save(c);

        // Notify all HR/Admin staff (holders of USER_MANAGE) about the new submission.
        String submitter = safeName(userId);
        String label = "NEED".equals(saved.getKind()) ? "need" : "complaint";
        userRepository.findByPermission("USER_MANAGE").forEach(staff -> {
            if (!staff.getId().equals(userId)) {
                notificationService.createAndPush(staff.getId(),
                        "New " + label + ": " + saved.getReferenceCode(),
                        submitter + " submitted a " + label,
                        "COMPLAINT", "/complaints");
            }
        });

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<ComplaintResponse> mySubmissions(Long userId, int page, int size) {
        Page<ComplaintNeed> result =
                repository.findByRaisedByOrderByCreatedAtDesc(userId, PageRequest.of(page, size));
        return PageResponse.from(result.map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public PageResponse<ComplaintResponse> all(String status, String kind, int page, int size) {
        String statusFilter = (status == null || status.isBlank()) ? null : status.toUpperCase();
        String kindFilter = (kind == null || kind.isBlank()) ? null : kind.toUpperCase();
        Page<ComplaintNeed> result =
                repository.filterAll(statusFilter, kindFilter, PageRequest.of(page, size));
        return PageResponse.from(result.map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public ComplaintResponse get(Long id) {
        return toResponse(find(id));
    }

    @Transactional
    public ComplaintResponse respond(Long staffId, Long id, ComplaintDecisionRequest req) {
        ComplaintNeed c = find(id);
        String status = req.status() == null ? "" : req.status().toUpperCase();
        if (!VALID_STATUS.contains(status)) {
            throw ApiException.business("Invalid status: " + req.status());
        }
        c.setStatus(status);
        if (req.response() != null && !req.response().isBlank()) {
            c.setHrResponse(req.response().trim());
        }
        c.setHandledBy(staffId);
        if (status.equals("RESOLVED") || status.equals("REJECTED")) {
            c.setResolvedAt(LocalDateTime.now());
        } else {
            c.setResolvedAt(null);
        }
        c.setUpdatedAt(LocalDateTime.now());
        ComplaintNeed saved = repository.save(c);

        // Notify the original submitter of the update.
        notificationService.createAndPush(saved.getRaisedBy(),
                saved.getReferenceCode() + " updated",
                "Your submission is now " + status.toLowerCase().replace('_', ' '),
                "COMPLAINT", "/complaints");

        return toResponse(saved);
    }

    // ---- helpers ----

    private ComplaintNeed find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Complaint/Need"));
    }

    private ComplaintResponse toResponse(ComplaintNeed c) {
        String raisedByName = safeName(c.getRaisedBy());
        String handledByName = c.getHandledBy() == null ? null : safeName(c.getHandledBy());
        return ComplaintResponse.from(c, raisedByName, handledByName);
    }

    private String safeName(Long userId) {
        if (userId == null) return null;
        return userRepository.findById(userId).map(User::getName).orElse("User");
    }

    private String generateCode() {
        // Increment from the highest existing code for this year — count()+1 breaks
        // after any row is deleted (it regenerates an already-used code).
        String prefix = "CN-" + Year.now().getValue() + "-";
        String max = repository.findMaxReferenceCode(prefix);
        long next = 1;
        if (max != null && max.length() > prefix.length()) {
            try {
                next = Long.parseLong(max.substring(prefix.length())) + 1;
            } catch (NumberFormatException ignored) {
                // Fall back to 1 if the suffix isn't numeric.
            }
        }
        return prefix + String.format("%05d", next);
    }

    private String normalise(String value, Set<String> allowed, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String upper = value.trim().toUpperCase();
        return allowed.contains(upper) ? upper : fallback;
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
