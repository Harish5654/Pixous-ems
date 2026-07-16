package com.pixous.hrportal.modules.org;

import com.pixous.hrportal.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Organisation master data + dropdowns.
 * Backwards-compatible with the legacy PHP API:
 *   GET  /api/org/dropdown/{type}        (single type, path form)
 *   GET  /api/org/dropdown?type=...      (single type, query form)
 *   POST /api/org/dropdowns  ["a","b"]   (array form)
 */
@RestController
@RequestMapping("/api/org")
@Tag(name = "Organisation", description = "Departments, designations, locations, sites, shifts, holidays, dropdowns")
public class OrgController {

    private final OrgService orgService;

    public OrgController(OrgService orgService) {
        this.orgService = orgService;
    }

    @GetMapping("/dropdown/{type}")
    @Operation(summary = "Single dropdown by type (path form)")
    public ApiResponse<List<DropdownItem>> dropdownByPath(@PathVariable String type,
            @RequestParam(required = false) String industry) {
        return ApiResponse.ok(orgService.dropdown(type, industry));
    }

    @GetMapping("/dropdown")
    @Operation(summary = "Single dropdown by type (query form)")
    public ApiResponse<List<DropdownItem>> dropdownByQuery(@RequestParam String type,
            @RequestParam(required = false) String industry) {
        return ApiResponse.ok(orgService.dropdown(type, industry));
    }

    @PostMapping("/dropdowns")
    @Operation(summary = "Multiple dropdowns in one call (array form)")
    public ApiResponse<Map<String, List<DropdownItem>>> dropdowns(@RequestBody List<String> types,
            @RequestParam(required = false) String industry) {
        return ApiResponse.ok(orgService.dropdowns(types, industry));
    }

    @GetMapping("/sites")
    @Operation(summary = "Active civil sites")
    public ApiResponse<List<Site>> sites() {
        return ApiResponse.ok(orgService.sites());
    }

    @GetMapping("/office-locations")
    @Operation(summary = "Active office locations")
    public ApiResponse<List<OfficeLocation>> officeLocations() {
        return ApiResponse.ok(orgService.officeLocations());
    }

    @GetMapping("/holidays")
    @Operation(summary = "Holiday calendar (optionally by year)")
    public ApiResponse<List<Holiday>> holidays(@RequestParam(required = false) Integer year) {
        return ApiResponse.ok(orgService.holidays(year));
    }

    @PostMapping("/holidays")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('ORG_MANAGE')")
    @Operation(summary = "Add a new holiday")
    public ApiResponse<Holiday> createHoliday(@jakarta.validation.Valid @RequestBody com.pixous.hrportal.modules.org.dto.HolidayRequest req) {
        return ApiResponse.ok(orgService.createHoliday(req), "Holiday created");
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/holidays/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('ORG_MANAGE')")
    @Operation(summary = "Remove a holiday")
    public ApiResponse<Void> deleteHoliday(@PathVariable Long id) {
        orgService.deleteHoliday(id);
        return ApiResponse.message("Holiday removed");
    }
}
