package com.pixous.hrportal.modules.workreport;

import com.pixous.hrportal.common.ApiException;
import com.pixous.hrportal.modules.user.User;
import com.pixous.hrportal.modules.user.UserRepository;
import com.pixous.hrportal.modules.workreport.dto.EmployeeWorkList;
import com.pixous.hrportal.modules.workreport.dto.WorkReportRequest;
import com.pixous.hrportal.modules.workreport.dto.WorkReportResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkReportService {

    private final WorkReportRepository repository;
    private final UserRepository userRepository;

    // ---------------- Employee (own rows) ----------------

    @Transactional(readOnly = true)
    public List<WorkReportResponse> mine(Long userId) {
        String name = userRepository.findById(userId).map(User::getName).orElse("?");
        String code = userRepository.findById(userId).map(User::getEmployeeCode).orElse("?");
        return repository.findByUserIdOrderByWorkDateDescIdDesc(userId).stream()
                .map(w -> WorkReportResponse.from(w, name, code))
                .toList();
    }

    @Transactional
    public WorkReportResponse create(Long userId, WorkReportRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User"));
        WorkReport w = new WorkReport();
        w.setUserId(userId);
        apply(w, req);
        WorkReport saved = repository.save(w);
        return WorkReportResponse.from(saved, user.getName(), user.getEmployeeCode());
    }

    @Transactional
    public WorkReportResponse update(Long userId, Long id, WorkReportRequest req) {
        WorkReport w = repository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Work report"));
        if (!w.getUserId().equals(userId)) {
            throw ApiException.business("You can only edit your own work reports");
        }
        apply(w, req);
        w.setUpdatedAt(java.time.LocalDateTime.now());
        User user = userRepository.findById(userId).orElseThrow();
        return WorkReportResponse.from(w, user.getName(), user.getEmployeeCode());
    }

    @Transactional
    public void delete(Long userId, Long id) {
        WorkReport w = repository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Work report"));
        if (!w.getUserId().equals(userId)) {
            throw ApiException.business("You can only delete your own work reports");
        }
        repository.delete(w);
    }

    // ---------------- HR / Admin (everyone, grouped, searchable) ----------------

    @Transactional(readOnly = true)
    public List<EmployeeWorkList> everyone(String q) {
        List<WorkReport> all = repository.findAllByOrderByWorkDateDescIdDesc();
        Map<Long, User> users = userRepository.findAllById(
                        all.stream().map(WorkReport::getUserId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u));

        // Preserve most-recent-first ordering while grouping by employee.
        Map<Long, List<WorkReport>> byUser = new LinkedHashMap<>();
        for (WorkReport w : all) {
            byUser.computeIfAbsent(w.getUserId(), k -> new ArrayList<>()).add(w);
        }

        String needle = q == null ? null : q.trim().toLowerCase();
        List<EmployeeWorkList> result = new ArrayList<>();
        for (Map.Entry<Long, List<WorkReport>> e : byUser.entrySet()) {
            User u = users.get(e.getKey());
            String name = u != null ? u.getName() : "?";
            String code = u != null ? u.getEmployeeCode() : "?";

            if (needle != null && !needle.isBlank()) {
                boolean match = name.toLowerCase().contains(needle)
                        || code.toLowerCase().contains(needle);
                if (!match) continue;
            }

            List<WorkReportResponse> rows = e.getValue().stream()
                    .map(w -> WorkReportResponse.from(w, name, code))
                    .toList();
            BigDecimal totalHours = e.getValue().stream()
                    .map(WorkReport::getWorkHours)
                    .filter(java.util.Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            result.add(new EmployeeWorkList(e.getKey(), name, code,
                    rows.size(), totalHours, rows));
        }
        return result;
    }

    // ---------------- helpers ----------------

    private void apply(WorkReport w, WorkReportRequest req) {
        w.setWorkDate(req.workDate());
        w.setProjectName(req.projectName());
        w.setWorkHours(req.workHours() == null ? BigDecimal.ZERO : req.workHours());
        w.setTaskDescription(req.taskDescription());
    }
}
