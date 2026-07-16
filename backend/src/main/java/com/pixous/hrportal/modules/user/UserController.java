package com.pixous.hrportal.modules.user;

import com.pixous.hrportal.common.ApiResponse;
import com.pixous.hrportal.common.PageResponse;
import com.pixous.hrportal.modules.user.dto.BankRequest;
import com.pixous.hrportal.modules.user.dto.BankResponse;
import com.pixous.hrportal.modules.user.dto.OffboardingRequest;
import com.pixous.hrportal.modules.user.dto.ProfileResponse;
import com.pixous.hrportal.modules.user.dto.UpdateProfileRequest;
import com.pixous.hrportal.modules.user.dto.UpdateEmployeeRequest;
import com.pixous.hrportal.modules.user.dto.UserSummary;
import com.pixous.hrportal.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users & Profile", description = "Self-service profile, photo, employee directory, bank details")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    @Operation(summary = "Get the signed-in user's profile")
    public ApiResponse<ProfileResponse> me() {
        return ApiResponse.ok(userService.getProfile(SecurityUtils.currentUserId()));
    }

    @PutMapping("/me")
    @Operation(summary = "Update the signed-in user's profile")
    public ApiResponse<ProfileResponse> updateMe(@Valid @RequestBody UpdateProfileRequest request) {
        return ApiResponse.ok(userService.updateProfile(SecurityUtils.currentUserId(), request),
                "Profile updated");
    }

    @PostMapping("/me/photo")
    @Operation(summary = "Upload / replace profile photo")
    public ApiResponse<Map<String, String>> uploadPhoto(@RequestParam("file") MultipartFile file) {
        String path = userService.updatePhoto(SecurityUtils.currentUserId(), file);
        return ApiResponse.ok(Map.of("photoPath", path), "Photo updated");
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('USER_MANAGE','ATTENDANCE_TEAM','DASHBOARD_EXEC')")
    @Operation(summary = "Employee directory (paged, searchable)")
    public ApiResponse<PageResponse<UserSummary>> directory(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(userService.directory(q, industry, departmentId, page, size));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('USER_MANAGE','ATTENDANCE_TEAM','DASHBOARD_EXEC')")
    @Operation(summary = "Get a single employee profile by id")
    public ApiResponse<ProfileResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(userService.getById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Operation(summary = "Update an employee profile by id")
    public ApiResponse<ProfileResponse> updateById(
            @PathVariable Long id,
            @Valid @RequestBody UpdateEmployeeRequest request) {
        return ApiResponse.ok(userService.updateEmployee(id, request), "Profile updated successfully");
    }

    @PostMapping("/{id}/offboarding")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Operation(summary = "Offboard an employee")
    public ApiResponse<Void> offboardUser(@PathVariable Long id, @Valid @RequestBody OffboardingRequest request) {
        userService.offboardUser(id, request);
        return ApiResponse.message("Employee offboarded successfully");
    }

    // ---- bank details ----

    @GetMapping("/me/bank")
    @Operation(summary = "List the signed-in user's bank accounts")
    public ApiResponse<List<BankResponse>> listBanks() {
        return ApiResponse.ok(userService.listBanks(SecurityUtils.currentUserId()));
    }

    @GetMapping("/{id}/bank")
    @PreAuthorize("hasAnyAuthority('PAYROLL_RUN', 'PAYROLL_VIEW', 'USER_MANAGE')")
    @Operation(summary = "List a specific employee's bank accounts")
    public ApiResponse<List<BankResponse>> listBanksForUser(@PathVariable Long id) {
        return ApiResponse.ok(userService.listBanks(id));
    }

    @PostMapping("/me/bank")
    @Operation(summary = "Add a bank account")
    public ApiResponse<BankResponse> addBank(@Valid @RequestBody BankRequest request) {
        return ApiResponse.ok(userService.addBank(SecurityUtils.currentUserId(), request),
                "Bank account added");
    }

    @PutMapping("/me/bank/{bankId}")
    @Operation(summary = "Update a bank account")
    public ApiResponse<BankResponse> updateBank(@PathVariable Long bankId,
                                                @Valid @RequestBody BankRequest request) {
        return ApiResponse.ok(userService.updateBank(SecurityUtils.currentUserId(), bankId, request),
                "Bank account updated");
    }

    @DeleteMapping("/me/bank/{bankId}")
    @Operation(summary = "Delete a bank account")
    public ApiResponse<Void> deleteBank(@PathVariable Long bankId) {
        userService.deleteBank(SecurityUtils.currentUserId(), bankId);
        return ApiResponse.message("Bank account deleted");
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Operation(summary = "Delete an employee account entirely")
    public ApiResponse<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ApiResponse.message("Employee deleted successfully");
    }
}
