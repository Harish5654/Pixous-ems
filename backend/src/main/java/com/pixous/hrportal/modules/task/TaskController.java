package com.pixous.hrportal.modules.task;

import com.pixous.hrportal.common.ApiResponse;
import com.pixous.hrportal.modules.task.dto.EmployeeTaskGroup;
import com.pixous.hrportal.modules.task.dto.TaskRequest;
import com.pixous.hrportal.modules.task.dto.TaskResponse;
import com.pixous.hrportal.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService service;

    // ---- Employee: own tasks ----

    @GetMapping("/me")
    public ApiResponse<List<TaskResponse>> mine() {
        return ApiResponse.ok(service.mine(SecurityUtils.currentUserId()));
    }

    @PostMapping("/{id}/complete")
    public ApiResponse<TaskResponse> complete(@PathVariable Long id) {
        return ApiResponse.ok(service.complete(SecurityUtils.currentUserId(), id), "Task marked complete");
    }

    // ---- Admin / HR: assign & view everyone ----

    @PostMapping
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<TaskResponse> assign(@Valid @RequestBody TaskRequest req) {
        return ApiResponse.ok(service.assign(SecurityUtils.currentUserId(), req), "Task assigned");
    }

    @GetMapping("/all")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<List<EmployeeTaskGroup>> everyone(
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) String q) {
        return ApiResponse.ok(service.everyone(industry, q));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.message("Task deleted");
    }
}
