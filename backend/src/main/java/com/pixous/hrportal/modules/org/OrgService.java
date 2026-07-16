package com.pixous.hrportal.modules.org;

import com.pixous.hrportal.common.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Master-data reads. {@link #dropdown(String)} reproduces the legacy
 * {@code dropdown.php?type=...} contract (single type) and {@link #dropdowns(List)}
 * supports the array form the Postman collection also used.
 */
@Service
public class OrgService {

    private final DepartmentRepository departmentRepository;
    private final DesignationRepository designationRepository;
    private final PositionRepository positionRepository;
    private final BloodGroupRepository bloodGroupRepository;
    private final EmploymentStatusRepository employmentStatusRepository;
    private final OfficeLocationRepository officeLocationRepository;
    private final ShiftRepository shiftRepository;
    private final SiteRepository siteRepository;
    private final HolidayRepository holidayRepository;

    public OrgService(DepartmentRepository departmentRepository,
                      DesignationRepository designationRepository,
                      PositionRepository positionRepository,
                      BloodGroupRepository bloodGroupRepository,
                      EmploymentStatusRepository employmentStatusRepository,
                      OfficeLocationRepository officeLocationRepository,
                      ShiftRepository shiftRepository,
                      SiteRepository siteRepository,
                      HolidayRepository holidayRepository) {
        this.departmentRepository = departmentRepository;
        this.designationRepository = designationRepository;
        this.positionRepository = positionRepository;
        this.bloodGroupRepository = bloodGroupRepository;
        this.employmentStatusRepository = employmentStatusRepository;
        this.officeLocationRepository = officeLocationRepository;
        this.shiftRepository = shiftRepository;
        this.siteRepository = siteRepository;
        this.holidayRepository = holidayRepository;
    }

    @Transactional(readOnly = true)
    public List<DropdownItem> dropdown(String type) {
        return dropdown(type, null);
    }

    @Transactional(readOnly = true)
    public List<DropdownItem> dropdown(String type, String industry) {
        return switch (normalize(type)) {
            case "blood_group" -> bloodGroupRepository.findByActiveTrueOrderByNameAsc()
                    .stream().map(b -> new DropdownItem(b.getId(), b.getName())).toList();
            case "department" -> departmentRepository.findByActiveTrueOrderByNameAsc()
                    .stream().map(d -> new DropdownItem(d.getId(), d.getName())).toList();
            case "designation" -> designationRepository.findActiveByIndustry(normalizeIndustry(industry))
                    .stream().map(d -> new DropdownItem(d.getId(), d.getName())).toList();
            case "employment_status" -> employmentStatusRepository.findByActiveTrueOrderByNameAsc()
                    .stream().map(e -> new DropdownItem(e.getId(), e.getName())).toList();
            case "position" -> positionRepository.findByActiveTrueOrderByNameAsc()
                    .stream().map(p -> new DropdownItem(p.getId(), p.getName())).toList();
            case "office_location" -> officeLocationRepository.findByActiveTrueOrderByNameAsc()
                    .stream().map(o -> new DropdownItem(o.getId(), o.getName())).toList();
            case "shift" -> shiftRepository.findByActiveTrueOrderByNameAsc()
                    .stream().map(s -> new DropdownItem(s.getId(), s.getName())).toList();
            case "site" -> siteRepository.findByActiveTrueOrderByNameAsc()
                    .stream().map(s -> new DropdownItem(s.getId(), s.getName())).toList();
            default -> throw ApiException.business("Unknown dropdown type: " + type);
        };
    }

    @Transactional(readOnly = true)
    public Map<String, List<DropdownItem>> dropdowns(List<String> types) {
        return dropdowns(types, null);
    }

    @Transactional(readOnly = true)
    public Map<String, List<DropdownItem>> dropdowns(List<String> types, String industry) {
        return types.stream().collect(Collectors.toMap(
                this::normalize, t -> dropdown(t, industry), (a, b) -> a, java.util.LinkedHashMap::new));
    }

    @Transactional(readOnly = true)
    public List<Site> sites() {
        return siteRepository.findByActiveTrueOrderByNameAsc();
    }

    @Transactional(readOnly = true)
    public List<OfficeLocation> officeLocations() {
        return officeLocationRepository.findByActiveTrueOrderByNameAsc();
    }

    @Transactional(readOnly = true)
    public List<Holiday> holidays(Integer year) {
        if (year == null) {
            return holidayRepository.findAllByOrderByHolidayDateAsc();
        }
        return holidayRepository.findByHolidayDateBetweenOrderByHolidayDateAsc(
                LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
    }

    @Transactional
    public Holiday createHoliday(com.pixous.hrportal.modules.org.dto.HolidayRequest req) {
        Holiday h = new Holiday();
        h.setName(req.name());
        h.setHolidayDate(req.holidayDate());
        return holidayRepository.save(h);
    }

    @Transactional
    public void deleteHoliday(Long id) {
        holidayRepository.deleteById(id);
    }

    private String normalize(String type) {
        return type == null ? "" : type.trim().toLowerCase().replace('-', '_');
    }

    /**
     * Canonicalise an industry filter to the codes stored in the DB.
     * Accepts the UI labels too ("DIGITAL"/"INFRA"). {@code null}/blank means
     * "no filter" so every active designation is returned.
     */
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
