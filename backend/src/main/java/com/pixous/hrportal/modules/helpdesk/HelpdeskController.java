package com.pixous.hrportal.modules.helpdesk;

import com.pixous.hrportal.common.ApiResponse;
import com.pixous.hrportal.common.PageResponse;
import com.pixous.hrportal.modules.helpdesk.dto.*;
import com.pixous.hrportal.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class HelpdeskController {

    private final HelpdeskService service;

    @GetMapping
    public PageResponse<TicketResponse> myTickets(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.myTickets(SecurityUtils.currentUserId(), page, size);
    }

    @PostMapping
    public ApiResponse<TicketResponse> create(@Valid @RequestBody TicketRequest req) {
        return ApiResponse.ok(service.raise(SecurityUtils.currentUserId(), req), "Ticket raised");
    }

    @GetMapping("/assigned-to-me")
    @PreAuthorize("hasAuthority('HELPDESK_AGENT')")
    public PageResponse<TicketResponse> agentQueue(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.agentQueue(SecurityUtils.currentUserId(), status, page, size);
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyAuthority('HELPDESK_AGENT','USER_MANAGE','DASHBOARD_EXEC')")
    public PageResponse<TicketResponse> allTickets(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return service.allTickets(status, page, size);
    }

    @GetMapping("/{id}")
    public ApiResponse<TicketResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @PostMapping("/{id}/comments")
    public ApiResponse<CommentResponse> comment(
            @PathVariable Long id, @Valid @RequestBody CommentRequest req) {
        return ApiResponse.ok(service.addComment(SecurityUtils.currentUserId(), id, req),
                "Comment added");
    }

    @PostMapping("/{id}/status")
    @PreAuthorize("hasAuthority('HELPDESK_AGENT')")
    public ApiResponse<TicketResponse> status(
            @PathVariable Long id, @Valid @RequestBody StatusRequest req) {
        return ApiResponse.ok(service.changeStatus(id, req), "Status updated");
    }

    @PostMapping("/{id}/rating")
    public ApiResponse<TicketResponse> rate(
            @PathVariable Long id, @Valid @RequestBody RatingRequest req) {
        return ApiResponse.ok(service.rate(SecurityUtils.currentUserId(), id, req), "Thanks for the feedback");
    }
}
