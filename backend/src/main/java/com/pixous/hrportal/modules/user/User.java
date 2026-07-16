package com.pixous.hrportal.modules.user;

import com.pixous.hrportal.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * The central identity record. Login is by {@code aadhar} (preserving the
 * contract of the legacy PHP API) and the same row carries the full address
 * block, employment master-data foreign keys, and security/lifecycle state.
 */
@Getter
@Setter
@Entity
@Table(name = "users")
public class User extends BaseEntity {

    @Column(name = "employee_code", unique = true, length = 40)
    private String employeeCode;

    /** Login identifier. Replaces Aadhaar as the credential used to sign in. */
    @Column(nullable = false, unique = true, length = 60)
    private String username;

    @Column(nullable = false, length = 150)
    private String name;

    private LocalDate dob;

    @Column(name="gender")
    private Character gender;

    /** Optional profile detail. No longer used for authentication. */
    @Column(unique = true, length = 12)
    private String aadhar;

    @Column(unique = true, length = 15)
    private String phone;

    @Column(length = 150)
    private String email;

    // ----- extra profile detail (from the company's employee sheet) -----
    @Column(length = 20)
    private String pan;
    @Column(name = "alternate_phone", length = 20)
    private String alternatePhone;
    @Column(name = "emergency_contact", length = 120)
    private String emergencyContact;
    @Column(name = "emergency_contact_relation", length = 60)
    private String emergencyContactRelation;
    @Column(name = "blood_group", length = 10)
    private String bloodGroup;
    @Column(name = "personal_email", length = 150)
    private String personalEmail;
    @Column(name = "designation_title", length = 150)
    private String designationTitle;
    @Column(name = "department_title", length = 150)
    private String departmentTitle;
    @Column(name = "position_title", length = 120)
    private String positionTitle;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "photo_path", length = 255)
    private String photoPath;

    // ----- address block -----
    @Column(name = "care_of", length = 120)
    private String careOf;
    @Column(length = 120)
    private String house;
    @Column(length = 150)
    private String street;
    @Column(length = 150)
    private String locality;
    @Column(length = 120)
    private String vtc;
    @Column(length = 120)
    private String district;
    @Column(length = 120)
    private String state;
    @Column(length = 120)
    private String country = "India";
    @Column(length = 10)
    private String pincode;
    @Column(name = "post_office", length = 120)
    private String postOffice;

    // ----- employment (master-data FKs kept as ids for simplicity) -----
    @Column(name = "blood_group_id")
    private Long bloodGroupId;
    @Column(name = "department_id")
    private Long departmentId;
    @Column(name = "designation_id")
    private Long designationId;
    @Column(name = "office_location_id")
    private Long officeLocationId;
    @Column(name = "employment_status_id")
    private Long employmentStatusId;
    @Column(name = "position_id")
    private Long positionId;
    @Column(name = "reporting_manager_id")
    private Long reportingManagerId;
    @Column(name = "site_id")
    private Long siteId;
    @Column(name = "employment_type", length = 30)
    private String employmentType = "PERMANENT";
    @Column(name = "date_of_joining")
    private LocalDate dateOfJoining;
    @Column(length = 20)
    private String industry = "IT";

    // ----- lifecycle + security -----
    @Column(name = "profile_status", length = 20)
    private String profileStatus = "PENDING";
    @Column(nullable = false)
    private boolean enabled = true;
    @Column(name = "failed_login_count", nullable = false)
    private int failedLoginCount = 0;
    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;
    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();
}
