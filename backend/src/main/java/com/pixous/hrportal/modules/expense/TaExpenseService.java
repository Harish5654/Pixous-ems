package com.pixous.hrportal.modules.expense;

import com.pixous.hrportal.common.ApiException;
import com.pixous.hrportal.modules.expense.dto.TaExpenseRequest;
import com.pixous.hrportal.modules.expense.dto.TaExpenseResponse;
import com.pixous.hrportal.modules.user.User;
import com.pixous.hrportal.modules.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TaExpenseService {

    private final TaExpenseRepository taExpenseRepository;
    private final UserRepository userRepository;

    public TaExpenseService(TaExpenseRepository taExpenseRepository, UserRepository userRepository) {
        this.taExpenseRepository = taExpenseRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public TaExpenseResponse createTaExpense(Long userId, TaExpenseRequest req) {
        TaExpense expense = new TaExpense();
        expense.setUserId(userId);
        expense.setDate(req.date());
        expense.setLocation(req.location());
        expense.setStartingKm(req.startingKm());
        expense.setEndingKm(req.endingKm());
        expense.setTotalKm(req.totalKm());
        expense.setHillsKm(req.hillsKm());
        expense.setPlainsKm(req.plainsKm());
        expense.setTotalAmount(req.totalAmount());
        expense.setBusFare(req.busFare());
        expense.setOthers(req.others());
        expense.setGrossTotal(req.grossTotal());
        expense.setRemarks(req.remarks());
        expense.setPetrolSlipPath(req.petrolSlipPath());
        expense.setPhotos(req.photos());
        expense.setStatus("PENDING");

        taExpenseRepository.save(expense);
        return toResponse(expense);
    }

    @Transactional(readOnly = true)
    public List<TaExpenseResponse> getMyTaExpenses(Long userId) {
        return taExpenseRepository.findByUserIdOrderByDateDesc(userId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<TaExpenseResponse> getAllTaExpenses() {
        return taExpenseRepository.findAll()
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public TaExpenseResponse updateStatus(Long id, String status) {
        TaExpense expense = taExpenseRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("TA Expense"));
        expense.setStatus(status);
        taExpenseRepository.save(expense);
        return toResponse(expense);
    }

    private TaExpenseResponse toResponse(TaExpense e) {
        String userName = "Unknown";
        if (e.getUser() != null) {
            userName = e.getUser().getName();
        } else {
            // fallback if relationship not loaded
            userName = userRepository.findById(e.getUserId()).map(User::getName).orElse("Unknown");
        }
        return new TaExpenseResponse(
                e.getId(), userName, e.getDate(), e.getLocation(),
                e.getStartingKm(), e.getEndingKm(), e.getTotalKm(),
                e.getHillsKm(), e.getPlainsKm(), e.getTotalAmount(),
                e.getBusFare(), e.getOthers(), e.getGrossTotal(),
                e.getRemarks(), e.getStatus(), e.getPetrolSlipPath(), e.getPhotos()
        );
    }
}
