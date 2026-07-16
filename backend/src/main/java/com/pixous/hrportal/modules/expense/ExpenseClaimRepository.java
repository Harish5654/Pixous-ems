package com.pixous.hrportal.modules.expense;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExpenseClaimRepository extends JpaRepository<ExpenseClaim, Long> {
    List<ExpenseClaim> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<ExpenseClaim> findByManagerStatusOrFinanceStatus(String managerStatus, String financeStatus);
}
