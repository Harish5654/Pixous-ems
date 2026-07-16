package com.pixous.hrportal.modules.workreport;

import com.pixous.hrportal.common.ApiResponse;
import com.pixous.hrportal.modules.workreport.dto.EmployeeWorkList;
import com.pixous.hrportal.modules.workreport.dto.WorkReportRequest;
import com.pixous.hrportal.modules.workreport.dto.WorkReportResponse;
import com.pixous.hrportal.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/work-reports")
@RequiredArgsConstructor
public class WorkReportController {

    private final WorkReportService service;

    // ---- Employee: own rows ----

    @GetMapping("/me")
    public ApiResponse<List<WorkReportResponse>> mine() {
        return ApiResponse.ok(service.mine(SecurityUtils.currentUserId()));
    }

    @PostMapping
    public ApiResponse<WorkReportResponse> create(@Valid @RequestBody WorkReportRequest req) {
        return ApiResponse.ok(service.create(SecurityUtils.currentUserId(), req), "Work report saved");
    }

    @PutMapping("/{id}")
    public ApiResponse<WorkReportResponse> update(@PathVariable Long id,
                                                  @Valid @RequestBody WorkReportRequest req) {
        return ApiResponse.ok(service.update(SecurityUtils.currentUserId(), id, req), "Work report updated");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(SecurityUtils.currentUserId(), id);
        return ApiResponse.message("Work report deleted");
    }

    // ---- HR / Admin: everyone grouped by employee, searchable ----

    @GetMapping("/all")
    @PreAuthorize("hasAnyAuthority('REPORT_VIEW','USER_MANAGE')")
    public ApiResponse<List<EmployeeWorkList>> everyone(@RequestParam(required = false) String q) {
        return ApiResponse.ok(service.everyone(q));
    }
}
