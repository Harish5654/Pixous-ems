package com.pixous.hrportal.modules.attendance;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "attendance")
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "punch_in_at")
    private LocalDateTime punchInAt;

    @Column(name = "punch_out_at")
    private LocalDateTime punchOutAt;

    @Column(length = 20)
    private String mode = "OFFICE";

    @Column(name = "in_latitude")
    private BigDecimal inLatitude;
    @Column(name = "in_longitude")
    private BigDecimal inLongitude;
    @Column(name = "out_latitude")
    private BigDecimal outLatitude;
    @Column(name = "out_longitude")
    private BigDecimal outLongitude;

    @Column(name = "site_id")
    private Long siteId;
    @Column(name = "shift_id")
    private Long shiftId;

    @Column(name = "within_geofence")
    private Boolean withinGeofence;

    @Column(length = 20)
    private String status = "PRESENT";

    @Column(name = "is_late", nullable = false)
    private boolean late = false;

    @Column(name = "worked_minutes")
    private Integer workedMinutes;

    @Column(name = "overtime_minutes")
    private Integer overtimeMinutes = 0;

    @Column(name = "geofence_exception", nullable = false)
    private boolean geofenceException = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();
}
