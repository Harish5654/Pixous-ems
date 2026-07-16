package com.pixous.hrportal.modules.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import java.util.List;

public record UpdateEmployeeRequest(
        @Size(max = 150) String name,
        String dob,
        String gender,
        @Email String email,
        String phone,
        String aadhar,
        String pan,
        String alternatePhone,
        String emergencyContact,
        String emergencyContactRelation,
        String bloodGroup,
        String personalEmail,
        String designationTitle,
        String departmentTitle,
        String positionTitle,
        String careOf, String house, String street, String locality, String vtc,
        String district, String state, String country, String pincode, String postOffice,
        String industry,
        Long departmentId,
        Long designationId,
        Long officeLocationId,
        Long reportingManagerId,
        String employmentType,
        String dateOfJoining,
        String profileStatus,
        String employeeCode,
        List<String> roles
) {}
