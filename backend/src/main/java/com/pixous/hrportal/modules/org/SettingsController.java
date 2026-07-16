package com.pixous.hrportal.modules.org;

import com.pixous.hrportal.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/settings")
@Tag(name = "Settings", description = "Global system settings")
public class SettingsController {

    private final SystemSettingRepository repository;

    public SettingsController(SystemSettingRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    @Operation(summary = "Get all settings as key-value map")
    public ApiResponse<Map<String, String>> getAllSettings() {
        Map<String, String> map = repository.findAll().stream()
                .collect(Collectors.toMap(SystemSetting::getKey, SystemSetting::getValue));
        return ApiResponse.ok(map);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Operation(summary = "Update settings")
    public ApiResponse<Void> updateSettings(@RequestBody Map<String, String> settings) {
        settings.forEach((k, v) -> {
            repository.findById(k).ifPresent(s -> {
                s.setValue(v);
                repository.save(s);
            });
        });
        return ApiResponse.message("Settings updated");
    }
}
