package com.pixous.hrportal.modules.auth;

import com.pixous.hrportal.common.ApiResponse;
import com.pixous.hrportal.modules.auth.dto.ChangePasswordRequest;
import com.pixous.hrportal.modules.auth.dto.CreateEmployeeRequest;
import com.pixous.hrportal.modules.auth.dto.LoginRequest;
import com.pixous.hrportal.modules.auth.dto.LoginResponse;
import com.pixous.hrportal.modules.auth.dto.PhoneValidateRequest;
import com.pixous.hrportal.modules.auth.dto.RefreshRequest;
import com.pixous.hrportal.modules.auth.dto.SignupRequest;
import com.pixous.hrportal.modules.auth.dto.TokenPair;
import com.pixous.hrportal.security.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Login, signup, token refresh, password management")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    @Operation(summary = "Login with username and password")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request,
                                             HttpServletRequest http) {
        LoginResponse response = authService.login(request, clientIp(http),
                http.getHeader("User-Agent"));
        return ApiResponse.ok(response, "Login successful");
    }

    @PostMapping("/signup")
    @Operation(summary = "Register a new employee account")
    public ResponseEntity<ApiResponse<LoginResponse>> signup(@Valid @RequestBody SignupRequest request) {
        LoginResponse response = authService.signup(request);
        return ResponseEntity.status(201).body(ApiResponse.ok(response, "Account created"));
    }

    @PostMapping("/employees")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Operation(summary = "HR/Admin: create an employee with a username + password")
    public ResponseEntity<ApiResponse<LoginResponse.AuthUser>> createEmployee(
            @Valid @RequestBody CreateEmployeeRequest request) {
        LoginResponse.AuthUser created = authService.createEmployee(request);
        return ResponseEntity.status(201)
                .body(ApiResponse.ok(created, "Employee account created"));
    }

    @PostMapping("/employees/bulk")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Operation(summary = "HR/Admin: bulk-create employees (e.g. from an Excel import)")
    public ApiResponse<java.util.List<com.pixous.hrportal.modules.auth.dto.BulkEmployeeResult>> createEmployeesBulk(
            @RequestBody java.util.List<CreateEmployeeRequest> requests) {
        java.util.List<com.pixous.hrportal.modules.auth.dto.BulkEmployeeResult> results =
                new java.util.ArrayList<>();
        for (CreateEmployeeRequest req : requests) {
            try {
                // Proxied call — each create runs in its own transaction, so one
                // bad row doesn't roll back the whole batch.
                authService.createEmployee(req);
                results.add(new com.pixous.hrportal.modules.auth.dto.BulkEmployeeResult(
                        req.username(), req.name(), true, null));
            } catch (Exception e) {
                results.add(new com.pixous.hrportal.modules.auth.dto.BulkEmployeeResult(
                        req.username(), req.name(), false, e.getMessage()));
            }
        }
        long ok = results.stream().filter(com.pixous.hrportal.modules.auth.dto.BulkEmployeeResult::created).count();
        return ApiResponse.ok(results, ok + " of " + results.size() + " employees created");
    }

    @GetMapping("/check-username")
    @Operation(summary = "Check whether a username is already taken")
    public ApiResponse<Map<String, Boolean>> checkUsername(@RequestParam String username) {
        return ApiResponse.ok(Map.of("available", !authService.usernameExists(username)));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Exchange a refresh token for a new access token")
    public ApiResponse<TokenPair> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResponse.ok(authService.refresh(request));
    }

    @GetMapping("/me")
    @Operation(summary = "Current signed-in user with roles and permissions")
    public ApiResponse<LoginResponse.AuthUser> me() {
        return ApiResponse.ok(authService.currentUser(SecurityUtils.currentUserId()));
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke all refresh tokens for the current user")
    public ApiResponse<Void> logout() {
        authService.logout(SecurityUtils.currentUserId());
        return ApiResponse.message("Logged out");
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change the current user's password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(SecurityUtils.currentUserId(), request);
        return ApiResponse.message("Password updated");
    }

    @PostMapping("/validate-phone")
    @Operation(summary = "Check whether a phone number is already registered")
    public ApiResponse<Map<String, Boolean>> validatePhone(@Valid @RequestBody PhoneValidateRequest request) {
        boolean exists = authService.phoneExists(request.phone());
        return ApiResponse.ok(Map.of("exists", exists));
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
