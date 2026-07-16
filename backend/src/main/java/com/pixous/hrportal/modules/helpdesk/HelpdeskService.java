package com.pixous.hrportal.modules.helpdesk;

import com.pixous.hrportal.common.ApiException;
import com.pixous.hrportal.common.PageResponse;
import com.pixous.hrportal.modules.helpdesk.dto.*;
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
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class HelpdeskService {

    private static final Set<String> VALID_STATUS = Set.of(
            "OPEN", "IN_PROGRESS", "AWAITING_PARTS", "RESOLVED", "CLOSED");

    private final TicketRepository ticketRepository;
    private final TicketCommentRepository commentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public TicketResponse raise(Long userId, TicketRequest req) {
        Ticket t = new Ticket();
        t.setTicketCode(generateTicketCode());
        t.setRaisedBy(userId);
        t.setTitle(req.title());
        t.setDescription(req.description());
        t.setType(req.type() == null ? "IT" : req.type().toUpperCase());
        t.setCategory(req.category());
        t.setPriority(req.priority() == null ? "MEDIUM" : req.priority().toUpperCase());
        t.setStatus("OPEN");
        t.setSlaDueAt(slaDue(t.getPriority()));
        Ticket saved = ticketRepository.save(t);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<TicketResponse> myTickets(Long userId, int page, int size) {
        Page<Ticket> result = ticketRepository
                .findByRaisedByOrderByCreatedAtDesc(userId, PageRequest.of(page, size));
        return PageResponse.from(result.map(this::toResponseNoComments));
    }

    @Transactional(readOnly = true)
    public PageResponse<TicketResponse> agentQueue(Long agentId, String status, int page, int size) {
        var pageable = PageRequest.of(page, size);
        Page<Ticket> result = (status != null && !status.isBlank())
                ? ticketRepository.findByStatusOrderByCreatedAtDesc(status.toUpperCase(), pageable)
                : ticketRepository.findByAssignedToOrderByCreatedAtDesc(agentId, pageable);
        return PageResponse.from(result.map(this::toResponseNoComments));
    }

    @Transactional(readOnly = true)
    public PageResponse<TicketResponse> allTickets(String status, int page, int size) {
        var pageable = PageRequest.of(page, size);
        Page<Ticket> result = (status != null && !status.isBlank())
                ? ticketRepository.findByStatusOrderByCreatedAtDesc(status.toUpperCase(), pageable)
                : ticketRepository.findAllByOrderByCreatedAtDesc(pageable);
        return PageResponse.from(result.map(this::toResponseNoComments));
    }

    @Transactional(readOnly = true)
    public TicketResponse get(Long id) {
        return toResponse(find(id));
    }

    @Transactional
    public CommentResponse addComment(Long userId, Long ticketId, CommentRequest req) {
        Ticket t = find(ticketId);
        TicketComment c = new TicketComment();
        c.setTicketId(ticketId);
        c.setAuthorId(userId);
        c.setComment(req.comment());
        c.setAttachmentPath(req.attachmentPath());
        TicketComment saved = commentRepository.save(c);

        // Notify the other party
        Long notifyTarget = userId.equals(t.getRaisedBy()) ? t.getAssignedTo() : t.getRaisedBy();
        if (notifyTarget != null && !notifyTarget.equals(userId)) {
            notificationService.createAndPush(notifyTarget,
                    "New comment on " + t.getTicketCode(),
                    safeName(userId) + " commented on your ticket",
                    "HELPDESK", "/helpdesk");
        }
        return CommentResponse.from(saved, safeName(userId));
    }

    @Transactional
    public TicketResponse changeStatus(Long ticketId, StatusRequest req) {
        Ticket t = find(ticketId);
        String status = req.status() == null ? "" : req.status().toUpperCase();
        if (!VALID_STATUS.contains(status)) {
            throw ApiException.business("Invalid status: " + req.status());
        }
        t.setStatus(status);
        if (req.assignTo() != null) {
            t.setAssignedTo(req.assignTo());
        }
        if (status.equals("RESOLVED") || status.equals("CLOSED")) {
            t.setResolvedAt(LocalDateTime.now());
        }
        t.setUpdatedAt(LocalDateTime.now());

        notificationService.createAndPush(t.getRaisedBy(),
                "Ticket " + t.getTicketCode() + " " + status.toLowerCase().replace('_', ' '),
                "Your ticket status changed to " + status,
                "HELPDESK", "/helpdesk");
        return toResponse(t);
    }

    @Transactional
    public TicketResponse rate(Long userId, Long ticketId, RatingRequest req) {
        Ticket t = find(ticketId);
        if (!t.getRaisedBy().equals(userId)) {
            throw ApiException.business("Only the requester can rate this ticket");
        }
        if (!"RESOLVED".equals(t.getStatus()) && !"CLOSED".equals(t.getStatus())) {
            throw ApiException.business("Only resolved tickets can be rated");
        }
        t.setRating(req.rating());
        t.setUpdatedAt(LocalDateTime.now());
        return toResponse(t);
    }

    // ---- helpers ----

    private Ticket find(Long id) {
        return ticketRepository.findById(id).orElseThrow(() -> ApiException.notFound("Ticket"));
    }

    private LocalDateTime slaDue(String priority) {
        LocalDateTime now = LocalDateTime.now();
        return switch (priority) {
            case "CRITICAL" -> now.plusHours(4);
            case "HIGH" -> now.plusHours(8);
            case "MEDIUM" -> now.plusHours(24);
            default -> now.plusHours(48);
        };
    }

    private String generateTicketCode() {
        long count = ticketRepository.count() + 1;
        return "TKT-" + Year.now().getValue() + "-" + String.format("%05d", count);
    }

    private String safeName(Long userId) {
        return userRepository.findById(userId).map(User::getName).orElse("User");
    }

    private TicketResponse toResponse(Ticket t) {
        List<CommentResponse> comments = commentRepository
                .findByTicketIdOrderByCreatedAtAsc(t.getId()).stream()
                .map(c -> CommentResponse.from(c, safeName(c.getAuthorId())))
                .toList();
        return TicketResponse.from(t, safeName(t.getRaisedBy()),
                t.getAssignedTo() == null ? null : safeName(t.getAssignedTo()), comments);
    }

    private TicketResponse toResponseNoComments(Ticket t) {
        return TicketResponse.from(t, safeName(t.getRaisedBy()),
                t.getAssignedTo() == null ? null : safeName(t.getAssignedTo()), List.of());
    }
}
