package com.pixous.hrportal.modules.expense.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record ExpenseClaimResponse(
        Long id,
        Long userId,
        String category,
        BigDecimal amount,
        LocalDate claimDate,
        String receiptPath,
        String managerStatus,
        String financeStatus,
        LocalDateTime createdAt
) {}
