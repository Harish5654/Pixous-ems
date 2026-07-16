package com.pixous.hrportal.modules.user.dto;

import java.time.LocalDate;
import java.util.List;

/** Full self/admin profile view including address block and employment metadata. */
public record ProfileResponse(
        Long id,
        String employeeCode,
        String name,
        LocalDate dob,
        String gender,
        String aadhar,
        String phone,
        String email,
        String photoPath,
        AddressDto address,
        Long departmentId,
        Long designationId,
        Long officeLocationId,
        Long reportingManagerId,
        String industry,
        String employmentType,
        LocalDate dateOfJoining,
        String profileStatus,
        String pan,
        String alternatePhone,
        String emergencyContact,
        String emergencyContactRelation,
        String bloodGroup,
        String personalEmail,
        String designationTitle,
        String departmentTitle,
        String positionTitle,
        List<String> roles
) {
    public record AddressDto(
            String careOf, String house, String street, String locality, String vtc,
            String district, String state, String country, String pincode, String postOffice
    ) {}
}
