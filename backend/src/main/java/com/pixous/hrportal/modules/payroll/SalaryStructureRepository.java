package com.pixous.hrportal.modules.payroll;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SalaryStructureRepository extends JpaRepository<SalaryStructure, Long> {
    Optional<SalaryStructure> findByUserIdAndActiveTrue(Long userId);
}
