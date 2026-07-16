package com.pixous.hrportal.modules.task;

import com.pixous.hrportal.common.ApiException;
import com.pixous.hrportal.common.SmsService;
import com.pixous.hrportal.modules.notification.NotificationService;
import com.pixous.hrportal.modules.task.dto.EmployeeTaskGroup;
import com.pixous.hrportal.modules.task.dto.TaskRequest;
import com.pixous.hrportal.modules.task.dto.TaskResponse;
import com.pixous.hrportal.modules.user.User;
import com.pixous.hrportal.modules.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository repository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final SmsService smsService;

    // ---------------- Admin / HR: assign & manage ----------------

    @Transactional
    public TaskResponse assign(Long adminId, TaskRequest req) {
        User assignee = userRepository.findById(req.assignedTo())
                .orElseThrow(() -> ApiException.notFound("Employee"));

        Task t = new Task();
        t.setTitle(req.title().trim());
        t.setDescription(req.description());
        t.setAssignedTo(assignee.getId());
        t.setAssignedBy(adminId);
        t.setDueDate(req.dueDate());
        t.setStatus("PENDING");
        Task saved = repository.save(t);

        String assignerName = userRepository.findById(adminId).map(User::getName).orElse("Admin");
        // Let the employee know a task is waiting for them.
        notificationService.createAndPush(
                assignee.getId(),
                "New task assigned",
                saved.getTitle(),
                "TASK",
                "/tasks");

        // SMS the assignee's mobile with the task details (fire-and-forget).
        String sms = "Pixous HR: Hi " + assignee.getName()
                + ", a new task has been assigned to you: \"" + saved.getTitle() + "\"."
                + " Employee ID: " + assignee.getEmployeeCode()
                + (saved.getDueDate() != null ? ". Due: " + saved.getDueDate() : "") + ".";
        smsService.send(assignee.getPhone(), sms);

        return toResponse(saved, assignee, assignerName);
    }

    @Transactional
    public void delete(Long taskId) {
        Task t = repository.findById(taskId).orElseThrow(() -> ApiException.notFound("Task"));
        repository.delete(t);
    }

    @Transactional(readOnly = true)
    public List<EmployeeTaskGroup> everyone(String industry, String q) {
        List<Task> all = repository.findAllByOrderByCreatedAtDesc();

        Map<Long, User> users = userRepository.findAllById(
                        all.stream().map(Task::getAssignedTo).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u));

        String wantIndustry = normalizeIndustry(industry);
        String needle = (q == null || q.isBlank()) ? null : q.trim().toLowerCase();

        // Preserve most-recent-first ordering while grouping per employee.
        Map<Long, List<Task>> byUser = new LinkedHashMap<>();
        for (Task t : all) {
            byUser.computeIfAbsent(t.getAssignedTo(), k -> new ArrayList<>()).add(t);
        }

        List<EmployeeTaskGroup> result = new ArrayList<>();
        for (Map.Entry<Long, List<Task>> e : byUser.entrySet()) {
            User u = users.get(e.getKey());
            String name = u != null ? u.getName() : "?";
            String code = u != null ? u.getEmployeeCode() : "?";
            String empIndustry = u != null ? u.getIndustry() : null;

            if (wantIndustry != null && !wantIndustry.equalsIgnoreCase(empIndustry)) {
                continue;
            }
            if (needle != null
                    && !name.toLowerCase().contains(needle)
                    && !code.toLowerCase().contains(needle)) {
                continue;
            }

            List<TaskResponse> rows = e.getValue().stream()
                    .map(t -> toResponse(t, u, resolveName(t.getAssignedBy())))
                    .toList();
            int pending = (int) rows.stream().filter(r -> "PENDING".equals(r.status())).count();
            int completed = rows.size() - pending;
            result.add(new EmployeeTaskGroup(e.getKey(), name, code, empIndustry,
                    rows.size(), pending, completed, rows));
        }
        return result;
    }

    // ---------------- Employee: own tasks ----------------

    @Transactional(readOnly = true)
    public List<TaskResponse> mine(Long userId) {
        User me = userRepository.findById(userId).orElse(null);
        return repository.findByAssignedToOrderByCreatedAtDesc(userId).stream()
                .map(t -> toResponse(t, me, resolveName(t.getAssignedBy())))
                .toList();
    }

    @Transactional
    public TaskResponse complete(Long userId, Long taskId) {
        Task t = repository.findById(taskId).orElseThrow(() -> ApiException.notFound("Task"));
        if (!t.getAssignedTo().equals(userId)) {
            throw ApiException.business("You can only complete tasks assigned to you");
        }
        if (!"COMPLETED".equals(t.getStatus())) {
            t.setStatus("COMPLETED");
            t.setCompletedAt(LocalDateTime.now());
            repository.save(t);

            // Notify the admin who assigned it, if any.
            if (t.getAssignedBy() != null) {
                String who = userRepository.findById(userId).map(User::getName).orElse("An employee");
                notificationService.createAndPush(
                        t.getAssignedBy(),
                        "Task completed",
                        who + " completed: " + t.getTitle(),
                        "TASK",
                        "/tasks");
            }
        }
        User me = userRepository.findById(userId).orElse(null);
        return toResponse(t, me, resolveName(t.getAssignedBy()));
    }

    // ---------------- helpers ----------------

    private TaskResponse toResponse(Task t, User assignee, String assignerName) {
        String name = assignee != null ? assignee.getName() : "?";
        String code = assignee != null ? assignee.getEmployeeCode() : "?";
        String industry = assignee != null ? assignee.getIndustry() : null;
        return TaskResponse.from(t, name, code, industry, assignerName);
    }

    private String resolveName(Long userId) {
        if (userId == null) return null;
        return userRepository.findById(userId).map(User::getName).orElse(null);
    }

    private String normalizeIndustry(String industry) {
        if (industry == null || industry.isBlank()) {
            return null;
        }
        String v = industry.trim().toUpperCase();
        return switch (v) {
            case "CIVIL", "INFRA" -> "CIVIL";
            case "IT", "DIGITAL" -> "IT";
            default -> v;
        };
    }
}
