package com.pixous.hrportal.modules.helpdesk.dto;

import jakarta.validation.constraints.NotBlank;

public record TicketRequest(
        @NotBlank String title,
        String description,
        String type,       // IT | FACILITY
        String category,
        String priority    // LOW | MEDIUM | HIGH | CRITICAL
) {}
