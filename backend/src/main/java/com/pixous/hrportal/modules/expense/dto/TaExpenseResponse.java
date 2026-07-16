package com.pixous.hrportal.modules.expense.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TaExpenseResponse(
    Long id,
    String userName,
    LocalDate date,
    String location,
    Integer startingKm,
    Integer endingKm,
    Integer totalKm,
    Integer hillsKm,
    Integer plainsKm,
    BigDecimal totalAmount,
    BigDecimal busFare,
    BigDecimal others,
    BigDecimal grossTotal,
    String remarks,
    String status,
    String petrolSlipPath,
    String photos
) {}
