package com.pixous.hrportal.modules.user.dto;

import java.time.LocalDate;
import java.util.List;

/** Compact row used in employee directory tables. */
public record UserSummary(
        Long id,
        String employeeCode,
        String name,
        String email,
        String phone,
        String industry,
        Long departmentId,
        String profileStatus,
        String photoPath,
        LocalDate dob,
        List<String> roles
) {}
