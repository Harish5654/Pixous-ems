package com.pixous.hrportal.modules.expense;

import com.pixous.hrportal.common.ApiException;
import com.pixous.hrportal.modules.expense.dto.ExpenseClaimResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class ExpenseService {

    private final ExpenseClaimRepository repository;

    public ExpenseService(ExpenseClaimRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public ExpenseClaimResponse submitClaim(Long userId, String category, BigDecimal amount, LocalDate date, String receiptPath) {
        ExpenseClaim c = new ExpenseClaim();
        c.setUserId(userId);
        c.setCategory(category);
        c.setAmount(amount);
        c.setClaimDate(date);
        c.setReceiptPath(receiptPath);
        return map(repository.save(c));
    }

    @Transactional(readOnly = true)
    public List<ExpenseClaimResponse> getMyClaims(Long userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId).stream().map(this::map).toList();
    }
    
    @Transactional(readOnly = true)
    public List<ExpenseClaimResponse> getPendingClaims() {
        return repository.findByManagerStatusOrFinanceStatus("PENDING", "PENDING").stream().map(this::map).toList();
    }

    @Transactional
    public ExpenseClaimResponse managerAction(Long claimId, String decision) {
        ExpenseClaim c = repository.findById(claimId).orElseThrow(() -> ApiException.notFound("Expense claim"));
        c.setManagerStatus(decision);
        return map(repository.save(c));
    }

    @Transactional
    public ExpenseClaimResponse financeAction(Long claimId, String decision) {
        ExpenseClaim c = repository.findById(claimId).orElseThrow(() -> ApiException.notFound("Expense claim"));
        c.setFinanceStatus(decision);
        return map(repository.save(c));
    }

    private ExpenseClaimResponse map(ExpenseClaim c) {
        return new ExpenseClaimResponse(
                c.getId(), c.getUserId(), c.getCategory(), c.getAmount(), c.getClaimDate(),
                c.getReceiptPath(), c.getManagerStatus(), c.getFinanceStatus(), c.getCreatedAt()
        );
    }
}
