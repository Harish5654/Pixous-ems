package com.pixous.hrportal.modules.dashboard;

import com.pixous.hrportal.common.ApiResponse;
import com.pixous.hrportal.modules.dashboard.dto.EmployeeDashboard;
import com.pixous.hrportal.modules.dashboard.dto.ExecutiveDashboard;
import com.pixous.hrportal.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService service;

    /** Personal widgets for the logged-in employee. */
    @GetMapping("/me")
    public ApiResponse<EmployeeDashboard> me() {
        return ApiResponse.ok(service.employee(SecurityUtils.currentUserId()));
    }

    /** Org-wide KPIs — restricted to executive / leadership roles. */
    @GetMapping("/executive")
    @PreAuthorize("hasAuthority('DASHBOARD_EXEC')")
    public ApiResponse<ExecutiveDashboard> executive(@RequestParam(required = false) String industry) {
        return ApiResponse.ok(service.executive(industry));
    }
}
