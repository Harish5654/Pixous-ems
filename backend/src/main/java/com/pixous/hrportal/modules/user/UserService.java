package com.pixous.hrportal.modules.user;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;


import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.pixous.hrportal.common.ApiException;
import com.pixous.hrportal.common.ErrorCode;
import com.pixous.hrportal.common.PageResponse;
import com.pixous.hrportal.common.StorageService;
import com.pixous.hrportal.modules.user.dto.BankRequest;
import com.pixous.hrportal.modules.user.dto.BankResponse;
import com.pixous.hrportal.modules.user.dto.OffboardingRequest;
import com.pixous.hrportal.modules.user.dto.ProfileResponse;
import com.pixous.hrportal.modules.user.dto.UpdateProfileRequest;
import com.pixous.hrportal.modules.user.dto.UpdateEmployeeRequest;
import com.pixous.hrportal.modules.user.dto.UserSummary;
import com.pixous.hrportal.modules.community.CommunityGroup;
import com.pixous.hrportal.modules.community.CommunityGroupRepository;
import com.pixous.hrportal.modules.community.CommunityMessageRepository;
import com.pixous.hrportal.modules.community.CommunityService;
import org.springframework.context.annotation.Lazy;

/** Profile read/update, photo upload, employee directory, and bank-detail CRUD. */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final BankDetailRepository bankDetailRepository;
    private final StorageService storageService;
    private final OffboardingRecordRepository offboardingRecordRepository;
    private final CommunityGroupRepository groupRepository;
    private final CommunityMessageRepository messageRepository;
    private final CommunityService communityService;
    private final jakarta.persistence.EntityManager entityManager;
    private final RoleRepository roleRepository;

    public UserService(UserRepository userRepository,
                       BankDetailRepository bankDetailRepository,
                       StorageService storageService,
                       OffboardingRecordRepository offboardingRecordRepository,
                       CommunityGroupRepository groupRepository,
                       CommunityMessageRepository messageRepository,
                       @Lazy CommunityService communityService,
                       jakarta.persistence.EntityManager entityManager,
                       RoleRepository roleRepository) {
        this.userRepository = userRepository;
        this.bankDetailRepository = bankDetailRepository;
        this.storageService = storageService;
        this.offboardingRecordRepository = offboardingRecordRepository;
        this.groupRepository = groupRepository;
        this.messageRepository = messageRepository;
        this.communityService = communityService;
        this.entityManager = entityManager;
        this.roleRepository = roleRepository;
    }

    @jakarta.annotation.PostConstruct
    public void copyChatbotImage() {
        try {
            java.io.File source = new java.io.File("C:/Users/balas/.gemini/antigravity/brain/17080dc6-1d50-41e0-9743-bebef22143f3/media__1784004964603.png");
            java.io.File targetDir = new java.io.File("c:/Users/balas/OneDrive/java bharu/correct/hmass/hr-portal-fixed-v5/hr-portal/web/public");
            if (source.exists() && targetDir.exists()) {
                java.io.File targetFile = new java.io.File(targetDir, "chatbot.png");
                java.nio.file.Files.copy(source.toPath(), targetFile.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                System.out.println("Chatbot image copied successfully to " + targetFile.getAbsolutePath());
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(Long userId) {
        return toProfile(findUser(userId));
    }

    @Transactional
    public ProfileResponse updateProfile(Long userId, UpdateProfileRequest req) {
        User user = findUser(userId);
        if (req.name() != null) user.setName(req.name());
        if (req.dob() != null && !req.dob().isBlank()) user.setDob(LocalDate.parse(req.dob()));
        if (req.gender() != null && !req.gender().isBlank()) {
    user.setGender(Character.toUpperCase(req.gender().trim().charAt(0)));
}
        if (req.email() != null) user.setEmail(req.email());
        if (req.careOf() != null) user.setCareOf(req.careOf());
        if (req.house() != null) user.setHouse(req.house());
        if (req.street() != null) user.setStreet(req.street());
        if (req.locality() != null) user.setLocality(req.locality());
        if (req.vtc() != null) user.setVtc(req.vtc());
        if (req.district() != null) user.setDistrict(req.district());
        if (req.state() != null) user.setState(req.state());
        if (req.country() != null) user.setCountry(req.country());
        if (req.pincode() != null) user.setPincode(req.pincode());
        if (req.postOffice() != null) user.setPostOffice(req.postOffice());
        userRepository.save(user);
        return toProfile(user);
    }

    @Transactional
    public ProfileResponse updateEmployee(Long id, UpdateEmployeeRequest req) {
        User user = findUser(id);
        if (req.name() != null) user.setName(req.name());
        if (req.dob() != null && !req.dob().isBlank()) user.setDob(LocalDate.parse(req.dob()));
        if (req.gender() != null && !req.gender().isBlank()) {
            user.setGender(Character.toUpperCase(req.gender().trim().charAt(0)));
        }
        if (req.email() != null) user.setEmail(blankToNull(req.email()));
        if (req.phone() != null) user.setPhone(blankToNull(req.phone()));
        if (req.aadhar() != null) user.setAadhar(blankToNull(req.aadhar()));
        if (req.pan() != null) user.setPan(blankToNull(req.pan()));
        if (req.alternatePhone() != null) user.setAlternatePhone(blankToNull(req.alternatePhone()));
        if (req.emergencyContact() != null) user.setEmergencyContact(blankToNull(req.emergencyContact()));
        if (req.emergencyContactRelation() != null) user.setEmergencyContactRelation(blankToNull(req.emergencyContactRelation()));
        if (req.bloodGroup() != null) user.setBloodGroup(blankToNull(req.bloodGroup()));
        if (req.personalEmail() != null) user.setPersonalEmail(blankToNull(req.personalEmail()));
        if (req.designationTitle() != null) user.setDesignationTitle(blankToNull(req.designationTitle()));
        if (req.departmentTitle() != null) user.setDepartmentTitle(blankToNull(req.departmentTitle()));
        if (req.positionTitle() != null) user.setPositionTitle(blankToNull(req.positionTitle()));
        if (req.careOf() != null) user.setCareOf(req.careOf());
        if (req.house() != null) user.setHouse(req.house());
        if (req.street() != null) user.setStreet(req.street());
        if (req.locality() != null) user.setLocality(req.locality());
        if (req.vtc() != null) user.setVtc(req.vtc());
        if (req.district() != null) user.setDistrict(req.district());
        if (req.state() != null) user.setState(req.state());
        if (req.country() != null && !req.country().isBlank()) user.setCountry(req.country());
        if (req.pincode() != null) user.setPincode(req.pincode());
        if (req.postOffice() != null) user.setPostOffice(req.postOffice());
        if (req.industry() != null) user.setIndustry(req.industry().trim().toUpperCase());
        if (req.departmentId() != null) user.setDepartmentId(req.departmentId());
        if (req.designationId() != null) user.setDesignationId(req.designationId());
        if (req.officeLocationId() != null) user.setOfficeLocationId(req.officeLocationId());
        if (req.reportingManagerId() != null) user.setReportingManagerId(req.reportingManagerId());
        if (req.employmentType() != null) user.setEmploymentType(req.employmentType());
        if (req.dateOfJoining() != null && !req.dateOfJoining().isBlank()) {
            user.setDateOfJoining(LocalDate.parse(req.dateOfJoining()));
        }
        if (req.profileStatus() != null) {
            String status = req.profileStatus().trim().toUpperCase();
            user.setProfileStatus(status);
            user.setEnabled(!"OFFBOARDED".equals(status));
        }
        if (req.employeeCode() != null) user.setEmployeeCode(req.employeeCode());
        if (req.roles() != null) {
            Set<Role> roles = roleRepository.findByCodeIn(new java.util.HashSet<>(req.roles()));
            user.setRoles(roles);
        }
        userRepository.save(user);
        return toProfile(user);
    }

    @Transactional
    public String updatePhoto(Long userId, MultipartFile file) {
        User user = findUser(userId);
        String path = storageService.store(file, "photos");
        user.setPhotoPath(path);
        userRepository.save(user);
        return path;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserSummary> directory(String q, String industry, Long departmentId,
                                               int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("name").ascending());
        Page<UserSummary> result = userRepository
                .search(blankToNull(q), blankToNull(industry), departmentId, pageable)
                .map(this::toSummary);
        return PageResponse.from(result);
    }

    @Transactional(readOnly = true)
    public ProfileResponse getById(Long id) {
        return toProfile(findUser(id));
    }

    @Transactional
    public void offboardUser(Long userId, OffboardingRequest req) {
        User user = findUser(userId);
        if ("OFFBOARDED".equals(user.getProfileStatus())) {
            throw new  ApiException(ErrorCode.BAD_CREDENTIALS,"User is already offboarded");
        }
        user.setProfileStatus("OFFBOARDED");
        user.setEnabled(false);
        userRepository.save(user);

        OffboardingRecord record = new OffboardingRecord();
        record.setUserId(userId);
        record.setRelievingDate(req.relievingDate());
        record.setReason(req.reason());
        record.setNotes(req.notes());
        record.setFnfStatus("PENDING");
        offboardingRecordRepository.save(record);
    }

    @Transactional
    public void deleteUser(Long userId) {
        User user = findUser(userId);

        // 0. Clean up legacy projects table manager association
        try {
            entityManager.createNativeQuery("UPDATE projects SET manager_id = NULL WHERE manager_id = :userId")
                    .setParameter("userId", userId)
                    .executeUpdate();
        } catch (Exception e) {
            try {
                entityManager.createNativeQuery("DELETE FROM projects WHERE manager_id = :userId")
                        .setParameter("userId", userId)
                        .executeUpdate();
            } catch (Exception ex) {
                // Ignore if table or column doesn't exist
            }
        }

        // 0.1 Clean up legacy teams table team lead association
        try {
            entityManager.createNativeQuery("UPDATE teams SET team_lead_id = NULL WHERE team_lead_id = :userId")
                    .setParameter("userId", userId)
                    .executeUpdate();
        } catch (Exception e) {
            try {
                entityManager.createNativeQuery("DELETE FROM teams WHERE team_lead_id = :userId")
                        .setParameter("userId", userId)
                        .executeUpdate();
            } catch (Exception ex) {
                // Ignore if table or column doesn't exist
            }
        }

        // 1. Set reporting manager of subordinates to null
        userRepository.findByReportingManagerId(userId).forEach(sub -> {
            sub.setReportingManagerId(null);
            userRepository.save(sub);
        });

        // 2. Clean up communities created by the user
        List<CommunityGroup> createdGroups = groupRepository.findByCreatedBy_Id(userId);
        for (CommunityGroup group : createdGroups) {
            communityService.deleteGroup(group.getId());
        }

        // 3. Delete messages sent by the user
        messageRepository.deleteBySender_Id(userId);

        // 4. Delete user (JPA will cascade delete other user-related entities)
        userRepository.delete(user);
    }

    // ---- bank details (mirrors legacy bank/index.php add|update|delete|view) ----

    @Transactional(readOnly = true)
    public List<BankResponse> listBanks(Long userId) {
        return bankDetailRepository.findByUserId(userId).stream().map(this::toBank).toList();
    }

    @Transactional
    public BankResponse addBank(Long userId, BankRequest req) {
        BankDetail bank = new BankDetail();
        bank.setUserId(userId);
        applyBank(bank, req);
        if (Boolean.TRUE.equals(req.primary())) {
            demoteOtherPrimaries(userId);
        }
        bankDetailRepository.save(bank);
        return toBank(bank);
    }

    @Transactional
    public BankResponse updateBank(Long userId, Long bankId, BankRequest req) {
        BankDetail bank = bankDetailRepository.findByIdAndUserId(bankId, userId)
                .orElseThrow(() -> ApiException.notFound("Bank detail"));
        applyBank(bank, req);
        if (Boolean.TRUE.equals(req.primary())) {
            demoteOtherPrimaries(userId);
            bank.setPrimary(true);
        }
        bankDetailRepository.save(bank);
        return toBank(bank);
    }

    @Transactional
    public void deleteBank(Long userId, Long bankId) {
        BankDetail bank = bankDetailRepository.findByIdAndUserId(bankId, userId)
                .orElseThrow(() -> ApiException.notFound("Bank detail"));
        bankDetailRepository.delete(bank);
    }

    // ---- helpers ----

    private void demoteOtherPrimaries(Long userId) {
        bankDetailRepository.findByUserId(userId).forEach(b -> {
            if (b.isPrimary()) {
                b.setPrimary(false);
                bankDetailRepository.save(b);
            }
        });
    }

    private void applyBank(BankDetail bank, BankRequest req) {
        bank.setBankName(req.bankName());
        bank.setBranchName(req.branchName());
        bank.setAccountNumber(req.accountNumber());
        bank.setIfscCode(req.ifscCode().toUpperCase());
        bank.setAccountHolderName(req.accountHolderName());
        if (req.primary() != null) {
            bank.setPrimary(req.primary());
        }
    }

    private User findUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> ApiException.notFound("User"));
    }

    private ProfileResponse toProfile(User u) {
        return new ProfileResponse(
                u.getId(), u.getEmployeeCode(), u.getName(), u.getDob(),
                 u.getGender() != null ? String.valueOf(u.getGender()) : null,
                u.getAadhar(), u.getPhone(), u.getEmail(), u.getPhotoPath(),
                new ProfileResponse.AddressDto(u.getCareOf(), u.getHouse(), u.getStreet(),
                        u.getLocality(), u.getVtc(), u.getDistrict(), u.getState(),
                        u.getCountry(), u.getPincode(), u.getPostOffice()),
                u.getDepartmentId(), u.getDesignationId(), u.getOfficeLocationId(),
                u.getReportingManagerId(), u.getIndustry(), u.getEmploymentType(),
                u.getDateOfJoining(), u.getProfileStatus(),
                u.getPan(), u.getAlternatePhone(), u.getEmergencyContact(),
                u.getEmergencyContactRelation(), u.getBloodGroup(), u.getPersonalEmail(),
                u.getDesignationTitle(), u.getDepartmentTitle(), u.getPositionTitle(),
                u.getRoles().stream().map(Role::getCode).toList());
    }

    private UserSummary toSummary(User u) {
        return new UserSummary(u.getId(), u.getEmployeeCode(), u.getName(), u.getEmail(),
                u.getPhone(), u.getIndustry(), u.getDepartmentId(), u.getProfileStatus(),
                u.getPhotoPath(), u.getDob(), u.getRoles().stream().map(Role::getCode).toList());
    }

    private BankResponse toBank(BankDetail b) {
        return new BankResponse(b.getId(), b.getBankName(), b.getBranchName(),
                b.getAccountNumber(), b.getIfscCode(), b.getAccountHolderName(), b.isPrimary());
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
