package com.pixous.hrportal.modules.user;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByAadhar(String aadhar);

    Optional<User> findByUsername(String username);

    Optional<User> findByPhone(String phone);

    Optional<User> findByEmployeeCode(String employeeCode);

    boolean existsByAadhar(String aadhar);

    boolean existsByUsername(String username);

    boolean existsByPhone(String phone);

    List<User> findByReportingManagerId(Long managerId);
    
    List<User> findByEnabledTrue();

    long countByReportingManagerId(Long managerId);

    long countByIndustry(String industry);

    @Query("""
            SELECT u FROM User u
            WHERE (:q IS NULL OR LOWER(u.name) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(u.username) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR u.aadhar LIKE CONCAT('%', :q, '%')
                   OR u.employeeCode LIKE CONCAT('%', :q, '%')
                   OR u.phone LIKE CONCAT('%', :q, '%'))
              AND (:industry IS NULL OR u.industry = :industry)
              AND (:departmentId IS NULL OR u.departmentId = :departmentId)
            """)
    Page<User> search(@Param("q") String q,
                      @Param("industry") String industry,
                      @Param("departmentId") Long departmentId,
                      Pageable pageable);

    @Query("SELECT MAX(u.employeeCode) FROM User u WHERE u.employeeCode LIKE CONCAT(:prefix, '%')")
    String findMaxEmployeeCode(@Param("prefix") String prefix);

    /** Enabled users who hold the given permission code through any of their roles. */
    @Query("""
            SELECT DISTINCT u FROM User u
            JOIN u.roles r
            JOIN r.permissions p
            WHERE p.code = :permission AND u.enabled = true
            """)
    List<User> findByPermission(@Param("permission") String permission);
}
