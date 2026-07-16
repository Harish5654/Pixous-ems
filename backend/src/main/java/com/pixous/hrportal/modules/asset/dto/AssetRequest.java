package com.pixous.hrportal.modules.asset.dto;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AssetRequest(
        @NotBlank String category,
        String assetType,
        String brand,
        String model,
        String serialNumber,
        String registrationNo,
        LocalDate purchaseDate,
        BigDecimal purchaseCost,
        LocalDate warrantyExpiry,
        LocalDate amcExpiry,
        Long siteId,
        BigDecimal depreciationRate
) {}
