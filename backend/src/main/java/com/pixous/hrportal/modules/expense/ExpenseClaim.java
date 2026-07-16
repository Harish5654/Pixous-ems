package com.pixous.hrportal.modules.expense;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "expense_claims")
public class ExpenseClaim {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(length = 60)
    private String category;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(name = "claim_date")
    private LocalDate claimDate;

    @Column(name = "receipt_path", length = 255)
    private String receiptPath;

    @Column(name = "manager_status", length = 20)
    private String managerStatus = "PENDING"; // PENDING|APPROVED|REJECTED

    @Column(name = "finance_status", length = 20)
    private String financeStatus = "PENDING"; // PENDING|APPROVED|REJECTED

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
