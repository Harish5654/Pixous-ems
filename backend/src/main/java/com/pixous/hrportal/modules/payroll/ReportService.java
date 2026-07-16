package com.pixous.hrportal.modules.payroll;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.pixous.hrportal.common.ApiException;
import com.pixous.hrportal.common.ErrorCode;
import com.pixous.hrportal.common.StorageService;
import com.pixous.hrportal.modules.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.Locale;

/** Generates payslip PDFs with OpenPDF and stores them via {@link StorageService}. */
@Service
@RequiredArgsConstructor
public class ReportService {

    private static final Color NAVY = new Color(0x1E, 0x29, 0x3B);
    private static final Color INDIGO = new Color(0x4F, 0x46, 0xE5);
    private static final Color LIGHT = new Color(0xF1, 0xF5, 0xF9);

    private final StorageService storageService;

    public String renderPayslipPdf(Payslip p, User user) {
        return renderPayslipPdf(p, user, user.getName(), user.getEmployeeCode());
    }

    public String renderPayslipPdf(Payslip p, User user, String displayName, String displayCode) {
        byte[] bytes = payslipPdfBytes(p, user, displayName, displayCode);
        String code = displayCode != null ? displayCode : user.getEmployeeCode();
        String filename = "payslip_" + code + "_"
                + p.getPayYear() + "_" + String.format("%02d", p.getPayMonth()) + ".pdf";
        return storageService.storeBytes(bytes, "payslips", filename);
    }

    public byte[] read(String relativePath) {
        return storageService.read(relativePath);
    }

    public byte[] generateAttendanceReport(java.time.LocalDate from, java.time.LocalDate to, Long deptId) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Attendance Report");
            org.apache.poi.ss.usermodel.Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Employee Code");
            header.createCell(1).setCellValue("Name");
            header.createCell(2).setCellValue("Date");
            header.createCell(3).setCellValue("Status");
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new ApiException(ErrorCode.INTERNAL, "Failed to generate report");
        }
    }

    public byte[] generateLeaveReport(java.time.LocalDate from, java.time.LocalDate to, Long deptId) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Leave Report");
            org.apache.poi.ss.usermodel.Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Employee Code");
            header.createCell(1).setCellValue("Name");
            header.createCell(2).setCellValue("Leave Type");
            header.createCell(3).setCellValue("From");
            header.createCell(4).setCellValue("To");
            header.createCell(5).setCellValue("Days");
            header.createCell(6).setCellValue("Status");
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new ApiException(ErrorCode.INTERNAL, "Failed to generate report");
        }
    }

    public byte[] generatePayrollReport(int month, int year) {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Payroll Report");
            org.apache.poi.ss.usermodel.Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Employee Code");
            header.createCell(1).setCellValue("Name");
            header.createCell(2).setCellValue("Gross Salary");
            header.createCell(3).setCellValue("Total Deductions");
            header.createCell(4).setCellValue("Net Pay");
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new ApiException(ErrorCode.INTERNAL, "Failed to generate report");
        }
    }

    public byte[] payslipPdfBytes(Payslip p, User user) {
        return payslipPdfBytes(p, user, user.getName(), user.getEmployeeCode());
    }

    public byte[] payslipPdfBytes(Payslip p, User user, String displayName, String displayCode) {
        Document doc = new Document(PageSize.A4, 40, 40, 48, 40);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(doc, out);
            doc.open();

            com.lowagie.text.Font h1 = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, NAVY);
            com.lowagie.text.Font sub = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.GRAY);
            com.lowagie.text.Font tiny = FontFactory.getFont(FontFactory.HELVETICA, 8, Color.GRAY);
            com.lowagie.text.Font label = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);
            com.lowagie.text.Font value = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, NAVY);

            // ---- Header: optional logo + company name ----
            String companyName = (p.getCompanyName() != null && !p.getCompanyName().isBlank())
                    ? p.getCompanyName() : "Pixous Technologies";

            byte[] logo = readLogoSafe(p.getCompanyLogo());
            if (logo != null) {
                try {
                    com.lowagie.text.Image img = com.lowagie.text.Image.getInstance(logo);
                    img.scaleToFit(120, 60);
                    doc.add(img);
                } catch (Exception ignored) {
                    // fall through to text-only header
                }
            }

            Paragraph title = new Paragraph(companyName, h1);
            doc.add(title);

            if (p.getCompanyAddress() != null && !p.getCompanyAddress().isBlank()) {
                Paragraph addr = new Paragraph(p.getCompanyAddress(), tiny);
                doc.add(addr);
            }
            if (p.getCompanyGstin() != null && !p.getCompanyGstin().isBlank()) {
                Paragraph gst = new Paragraph("GSTIN: " + p.getCompanyGstin(), tiny);
                doc.add(gst);
            }

            String monthName = Month.of(p.getPayMonth())
                    .getDisplayName(TextStyle.FULL, Locale.ENGLISH);
            Paragraph slipFor = new Paragraph(
                    "Payslip for " + monthName + " " + p.getPayYear(), sub);
            slipFor.setSpacingBefore(6);
            slipFor.setSpacingAfter(14);
            doc.add(slipFor);

            // ---- Meta grid ----
            String designation = p.getDesignation() != null && !p.getDesignation().isBlank()
                    ? p.getDesignation()
                    : (user.getDesignationId() == null ? "-" : "ID " + user.getDesignationId());
            String payDate = p.getPayDate() != null ? p.getPayDate().toString() : "-";
            String workingDays = p.getWorkingDays() != null ? String.valueOf(p.getWorkingDays()) : "-";

            PdfPTable meta = new PdfPTable(4);
            meta.setWidthPercentage(100);
            meta.setWidths(new float[]{1.3f, 2f, 1.3f, 2f});
            meta.setSpacingAfter(16);
            metaCell(meta, "Employee", label);
            metaCell(meta, nz(displayName), value);
            metaCell(meta, "Emp Code", label);
            metaCell(meta, nz(displayCode), value);
            metaCell(meta, "Designation", label);
            metaCell(meta, designation, value);
            metaCell(meta, "Department", label);
            metaCell(meta, nz(p.getDepartment()), value);
            metaCell(meta, "Pay Date", label);
            metaCell(meta, payDate, value);
            metaCell(meta, "Working Days", label);
            metaCell(meta, workingDays, value);
            metaCell(meta, "Bank", label);
            metaCell(meta, nz(p.getBankName()), value);
            metaCell(meta, "Bank A/C", label);
            metaCell(meta, nz(p.getBankAccount()), value);
            metaCell(meta, "LOP Days", label);
            metaCell(meta, p.getLopDays().toPlainString(), value);
            metaCell(meta, "", label);
            metaCell(meta, "", value);
            doc.add(meta);

            // ---- Earnings / deductions columns (only non-zero extra lines shown) ----
            java.util.List<String[]> earnings = new java.util.ArrayList<>();
            earnings.add(new String[]{"Basic Salary", money(p.getBasicSalary())});
            earnings.add(new String[]{"HRA", money(p.getHra())});
            earnings.add(new String[]{"Allowances", money(p.getAllowances())});
            if (p.getOvertimePay() != null && p.getOvertimePay().signum() != 0)
                earnings.add(new String[]{"Overtime", money(p.getOvertimePay())});
            if (p.getPerformancePay() != null && p.getPerformancePay().signum() != 0)
                earnings.add(new String[]{"Performance Pay", money(p.getPerformancePay())});
            if (p.getExpensesPay() != null && p.getExpensesPay().signum() != 0)
                earnings.add(new String[]{"Expenses", money(p.getExpensesPay())});
            earnings.add(new String[]{"Gross", money(p.getGrossSalary())});

            java.util.List<String[]> deductions = new java.util.ArrayList<>();
            deductions.add(new String[]{"PF", money(p.getPfDeduction())});
            deductions.add(new String[]{"ESI", money(p.getEsiDeduction())});
            deductions.add(new String[]{"Professional Tax", money(p.getPtDeduction())});
            deductions.add(new String[]{"TDS", money(p.getTdsDeduction())});
            if (p.getHealthInsurance() != null && p.getHealthInsurance().signum() != 0)
                deductions.add(new String[]{"Health Insurance", money(p.getHealthInsurance())});
            if (p.getSalaryAdvance() != null && p.getSalaryAdvance().signum() != 0)
                deductions.add(new String[]{"Salary Advance", money(p.getSalaryAdvance())});
            if (p.getOtherDeductions() != null && p.getOtherDeductions().signum() != 0)
                deductions.add(new String[]{"Other", money(p.getOtherDeductions())});
            deductions.add(new String[]{"Total Deductions", money(p.getTotalDeductions())});

            PdfPTable cols = new PdfPTable(2);
            cols.setWidthPercentage(100);
            cols.setWidths(new float[]{1f, 1f});
            cols.addCell(sectionTable("Earnings", earnings.toArray(new String[0][]), true));
            cols.addCell(sectionTable("Deductions", deductions.toArray(new String[0][]), false));
            doc.add(cols);

            PdfPTable net = new PdfPTable(2);
            net.setWidthPercentage(100);
            net.setWidths(new float[]{2.5f, 1.5f});
            net.setSpacingBefore(18);
            PdfPCell l = new PdfPCell(new Phrase("NET PAY",
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.WHITE)));
            l.setBackgroundColor(INDIGO);
            l.setPadding(10);
            l.setBorder(Rectangle.NO_BORDER);

            PdfPCell r = new PdfPCell(new Phrase("INR " + money(p.getNetPay()),
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.WHITE)));
            r.setBackgroundColor(INDIGO);
            r.setHorizontalAlignment(Element.ALIGN_RIGHT);
            r.setPadding(10);
            r.setBorder(Rectangle.NO_BORDER);

            net.addCell(l);
            net.addCell(r);
            doc.add(net);

            Paragraph foot = new Paragraph(
                    "This is a system-generated payslip and does not require a signature.",
                    FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 8, Color.GRAY));
            foot.setSpacingBefore(24);
            doc.add(foot);

            doc.close();
            return out.toByteArray();
        } catch (DocumentException e) {
            throw new ApiException(ErrorCode.INTERNAL, "Failed to render payslip PDF");
        }
    }

    /** Reads a stored logo by relative path; returns null on any problem. */
    private byte[] readLogoSafe(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) return null;
        try {
            return storageService.read(relativePath);
        } catch (Exception e) {
            return null;
        }
    }

    private PdfPTable sectionTable(String heading, String[][] rows, boolean leftPad) {
        PdfPTable t = new PdfPTable(2);
        t.setWidthPercentage(100);

        com.lowagie.text.Font hd = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
        PdfPCell head = new PdfPCell(new Phrase(heading, hd));
        head.setColspan(2);
        head.setBackgroundColor(NAVY);
        head.setPadding(7);
        head.setBorder(Rectangle.NO_BORDER);
        t.addCell(head);

        com.lowagie.text.Font k = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);
        com.lowagie.text.Font v = FontFactory.getFont(FontFactory.HELVETICA, 9, NAVY);

        boolean alt = false;
        for (String[] row : rows) {
            PdfPCell kc = new PdfPCell(new Phrase(row[0], k));
            PdfPCell vc = new PdfPCell(new Phrase(row[1], v));
            vc.setHorizontalAlignment(Element.ALIGN_RIGHT);
            kc.setPadding(6);
            vc.setPadding(6);
            kc.setBorder(Rectangle.BOTTOM);
            vc.setBorder(Rectangle.BOTTOM);
            kc.setBorderColor(LIGHT);
            vc.setBorderColor(LIGHT);

            if (alt) {
                kc.setBackgroundColor(LIGHT);
                vc.setBackgroundColor(LIGHT);
            }

            t.addCell(kc);
            t.addCell(vc);
            alt = !alt;
        }

        PdfPCell container = new PdfPCell(t);
        container.setBorder(Rectangle.NO_BORDER);
        container.setPaddingLeft(leftPad ? 0 : 8);
        container.setPaddingRight(leftPad ? 8 : 0);

        PdfPTable wrapper = new PdfPTable(1);
        wrapper.setWidthPercentage(100);
        wrapper.addCell(container);
        return wrapper;
    }

    private void metaCell(PdfPTable t, String text, com.lowagie.text.Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text, font));
        c.setBorder(Rectangle.NO_BORDER);
        c.setPadding(4);
        t.addCell(c);
    }

    private static String money(BigDecimal v) {
        return String.format(Locale.ENGLISH, "%,.2f", v == null ? BigDecimal.ZERO : v);
    }

    private static String nz(String s) {
        return s == null ? "-" : s;
    }
}