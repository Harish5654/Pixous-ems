package com.pixous.hrportal.modules.expense;

import com.pixous.hrportal.common.ApiResponse;
import com.pixous.hrportal.modules.expense.dto.ExpenseClaimResponse;
import com.pixous.hrportal.security.SecurityUtils;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/finance/expenses")
public class ExpenseController {

    private final ExpenseService service;

    public ExpenseController(ExpenseService service) {
        this.service = service;
    }

    @PostMapping
    public ApiResponse<ExpenseClaimResponse> submitClaim(
            @RequestParam String category,
            @RequestParam BigDecimal amount,
            @RequestParam LocalDate date,
            @RequestParam(required = false) String receiptPath) {
        return ApiResponse.ok(service.submitClaim(SecurityUtils.currentUserId(), category, amount, date, receiptPath), "Expense submitted");
    }

    @GetMapping("/me")
    public ApiResponse<List<ExpenseClaimResponse>> myClaims() {
        return ApiResponse.ok(service.getMyClaims(SecurityUtils.currentUserId()));
    }

    @GetMapping("/pending")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('PAYROLL_APPROVE') or hasAuthority('USER_MANAGE')")
    public ApiResponse<List<ExpenseClaimResponse>> pendingClaims() {
        return ApiResponse.ok(service.getPendingClaims());
    }

    @PostMapping("/{id}/manager-action")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<ExpenseClaimResponse> managerAction(@PathVariable Long id, @RequestParam String decision) {
        return ApiResponse.ok(service.managerAction(id, decision));
    }

    @PostMapping("/{id}/finance-action")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('PAYROLL_APPROVE')")
    public ApiResponse<ExpenseClaimResponse> financeAction(@PathVariable Long id, @RequestParam String decision) {
        return ApiResponse.ok(service.financeAction(id, decision));
    }
}
