package com.pixous.hrportal.modules.payroll;

import com.pixous.hrportal.common.ApiResponse;
import com.pixous.hrportal.modules.payroll.dto.*;
import com.pixous.hrportal.security.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payroll")
@RequiredArgsConstructor
public class PayrollController {

    private final PayslipService service;
    private final PayslipRequestService requestService;
    private final com.pixous.hrportal.common.StorageService storageService;

    /** Generate (or regenerate) a payslip — Finance/HR only. Mirrors payslip action=generate. */
    @PostMapping("/payslip/generate")
    @PreAuthorize("hasAuthority('PAYROLL_RUN')")
    public ApiResponse<PayslipResponse> generate(@Valid @RequestBody GeneratePayslipRequest req) {
        return ApiResponse.ok(service.generate(req), "Payslip generated");
    }

    /** List the caller's own payslips. Mirrors payslip action=list. */
    @GetMapping("/payslip/list")
    public ApiResponse<List<PayslipSummary>> myPayslips() {
        return ApiResponse.ok(service.list(SecurityUtils.currentUserId()));
    }

    /** List a specific employee's payslips — privileged. */
    @GetMapping("/payslip/list/{userId}")
    @PreAuthorize("hasAuthority('PAYROLL_VIEW')")
    public ApiResponse<List<PayslipSummary>> payslipsFor(@PathVariable Long userId) {
        return ApiResponse.ok(service.list(userId));
    }

    @GetMapping("/payslip/{id}")
    public ApiResponse<PayslipResponse> get(@PathVariable Long id) {
        boolean privileged = SecurityUtils.hasAuthority("PAYROLL_VIEW");
        return ApiResponse.ok(service.get(SecurityUtils.currentUserId(), id, privileged));
    }

    @GetMapping("/payslip/{id}/pdf")
    public ResponseEntity<ByteArrayResource> downloadPdf(@PathVariable Long id) {
        boolean privileged = SecurityUtils.hasAuthority("PAYROLL_VIEW");
        byte[] bytes = service.pdfBytes(SecurityUtils.currentUserId(), id, privileged);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=payslip-" + id + ".pdf")
                .body(new ByteArrayResource(bytes));
    }

    @PostMapping("/runs")
    @PreAuthorize("hasAuthority('PAYROLL_RUN')")
    public ApiResponse<PayrollRunResponse> startBatch(@Valid @RequestBody PayrollRunRequest req) {
        return ApiResponse.ok(service.generateBatch(req.month(), req.year(), SecurityUtils.currentUserId()), "Payroll run started");
    }

    @PostMapping("/runs/{id}/confirm")
    @PreAuthorize("hasAuthority('PAYROLL_RUN')")
    public ApiResponse<PayrollRunResponse> confirmRun(@PathVariable Long id) {
        return ApiResponse.ok(service.confirmRun(id, SecurityUtils.currentUserId()), "Payroll run confirmed");
    }

    @PostMapping("/runs/{id}/finance-approve")
    @PreAuthorize("hasAuthority('PAYROLL_APPROVE')")
    public ApiResponse<PayrollRunResponse> financeApproveRun(@PathVariable Long id) {
        return ApiResponse.ok(service.financeApproveRun(id, SecurityUtils.currentUserId()), "Payroll run approved by finance");
    }

    @GetMapping("/runs")
    @PreAuthorize("hasAnyAuthority('PAYROLL_RUN', 'PAYROLL_APPROVE')")
    public ApiResponse<List<PayrollRunSummary>> listRuns() {
        return ApiResponse.ok(service.listRuns());
    }

    @GetMapping("/runs/{id}")
    @PreAuthorize("hasAnyAuthority('PAYROLL_RUN', 'PAYROLL_APPROVE')")
    public ApiResponse<PayrollRunResponse> getRun(@PathVariable Long id) {
        return ApiResponse.ok(service.getRun(id));
    }

    // ============================================================
    // Payslip request workflow
    //   Employee / HR / Manager raise a request -> Admin approves by
    //   filling the customizable form -> requester downloads.
    // ============================================================

    /** Raise a payslip request for a month (any authenticated user). */
    @PostMapping("/requests")
    public ApiResponse<PayslipRequestResponse> raiseRequest(@Valid @RequestBody CreatePayslipRequestDto req) {
        return ApiResponse.ok(
                requestService.raise(SecurityUtils.currentUserId(), req.month(), req.year(), req.note()),
                "Payslip request sent to admin");
    }

    /** The caller's own payslip requests. */
    @GetMapping("/requests/me")
    public ApiResponse<List<PayslipRequestResponse>> myRequests() {
        return ApiResponse.ok(requestService.myRequests(SecurityUtils.currentUserId()));
    }

    /** Admin inbox of payslip requests (defaults to pending only). */
    @GetMapping("/requests")
    @PreAuthorize("hasAuthority('PAYROLL_RUN')")
    public ApiResponse<List<PayslipRequestResponse>> inbox(
            @RequestParam(name = "pendingOnly", defaultValue = "true") boolean pendingOnly) {
        return ApiResponse.ok(requestService.adminInbox(pendingOnly));
    }

    /** Admin uploads a company logo to embed in the generated payslip. */
    @PostMapping("/requests/logo")
    @PreAuthorize("hasAuthority('PAYROLL_RUN')")
    public ApiResponse<Map<String, String>> uploadLogo(@RequestParam("file") MultipartFile file) {
        String path = storageService.store(file, "payslip-logos");
        return ApiResponse.ok(Map.of("path", path), "Logo uploaded");
    }

    /** Admin approves a request by generating the customizable payslip. */
    @PostMapping("/requests/{id}/approve")
    @PreAuthorize("hasAuthority('PAYROLL_RUN')")
    public ApiResponse<PayslipResponse> approveRequest(
            @PathVariable Long id, @Valid @RequestBody ApprovePayslipRequestDto form) {
        return ApiResponse.ok(
                requestService.approve(SecurityUtils.currentUserId(), id, form),
                "Payslip generated and sent to employee");
    }

    /** Admin rejects a request. */
    @PostMapping("/requests/{id}/reject")
    @PreAuthorize("hasAuthority('PAYROLL_RUN')")
    public ApiResponse<PayslipRequestResponse> rejectRequest(
            @PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        String note = body != null ? body.get("note") : null;
        return ApiResponse.ok(
                requestService.reject(SecurityUtils.currentUserId(), id, note),
                "Request rejected");
    }
}
