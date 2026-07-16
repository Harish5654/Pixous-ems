package com.pixous.hrportal.modules.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * HR / Admin create-employee payload. The creator sets the username and an
 * initial password manually; the employee then logs in with those. Aadhaar and
 * phone are optional profile details.
 */
public record CreateEmployeeRequest(
        @NotBlank(message = "Username is required")
        @Size(min = 3, max = 60, message = "Username must be 3–60 characters")
        @Pattern(regexp = "^[A-Za-z0-9._-]+$",
                 message = "Username may only contain letters, numbers, dot, underscore or hyphen")
        String username,

        @NotBlank(message = "Password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        String password,

        @NotBlank(message = "Name is required")
        @Size(max = 150)
        String name,

        String dob,
        String gender,

        @Pattern(regexp = "^$|\\d{12}", message = "Aadhaar must be 12 digits when provided")
        String aadhar,

        @Pattern(regexp = "^$|\\d{10,15}", message = "Invalid phone number")
        String phone,

        String email,

        // address block (all optional)
        String careOf, String house, String street, String locality, String vtc,
        String district, String state, String country, String pincode, String postOffice,

        // employment metadata (all optional)
        String industry,
        String roleCode,
        String dateOfJoining,
        Long departmentId,
        Long designationId,
        Long officeLocationId,
        Long reportingManagerId,

        // extra profile detail (all optional)
        String pan,
        String alternatePhone,
        String emergencyContact,
        String emergencyContactRelation,
        String bloodGroup,
        String personalEmail,
        String designationTitle,
        String departmentTitle,
        String positionTitle,
        String profileStatus
) {}
