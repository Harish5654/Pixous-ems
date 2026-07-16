package com.pixous.hrportal.modules.community;

import com.pixous.hrportal.common.StorageService;
import com.pixous.hrportal.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/communities")
@RequiredArgsConstructor
public class CommunityController {

    private final CommunityService communityService;
    private final StorageService storageService;

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PostMapping
    public ResponseEntity<CommunityDTOs.GroupResponse> createGroup(
            @RequestBody CommunityDTOs.CreateGroupRequest request) {
        Long adminId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(communityService.createGroup(request, adminId));
    }

    @GetMapping
    public ResponseEntity<List<CommunityDTOs.GroupResponse>> getAllCommunities() {
        return ResponseEntity.ok(communityService.getAllCommunities());
    }

    @GetMapping("/me")
    public ResponseEntity<List<CommunityDTOs.GroupResponse>> getMyCommunities() {
        return ResponseEntity.ok(communityService.getUserCommunities(SecurityUtils.currentUserId()));
    }

    /** Enabled users the signed-in user can start a private 1:1 chat with. */
    @GetMapping("/contacts")
    public ResponseEntity<List<com.pixous.hrportal.modules.user.dto.UserSummary>> getContacts() {
        return ResponseEntity.ok(communityService.getContacts(SecurityUtils.currentUserId()));
    }

    /** Find-or-create the private 1:1 conversation with the given user. */
    @PostMapping("/direct/{userId}")
    public ResponseEntity<CommunityDTOs.GroupResponse> openDirect(@PathVariable Long userId) {
        return ResponseEntity.ok(communityService.openDirect(SecurityUtils.currentUserId(), userId));
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteGroup(@PathVariable Long id) {
        communityService.deleteGroup(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<com.pixous.hrportal.modules.user.dto.UserSummary>> getMembers(@PathVariable Long id) {
        return ResponseEntity.ok(communityService.getMembers(id, SecurityUtils.currentUserId()));
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PostMapping("/{id}/members")
    public ResponseEntity<Void> addMember(@PathVariable Long id, @RequestBody CommunityDTOs.AddMemberRequest request) {
        communityService.addMember(id, request.getUserId());
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long id, @PathVariable Long userId) {
        communityService.removeMember(id, userId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/messages")
    public ResponseEntity<List<CommunityDTOs.ChatMessagePayload>> getMessages(@PathVariable Long id) {
        return ResponseEntity.ok(communityService.getMessages(id, SecurityUtils.currentUserId()));
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<Void> sendMessage(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload) {
        communityService.sendMessage(id, SecurityUtils.currentUserId(), payload.get("content"));
        return ResponseEntity.ok().build();
    }

    /** Send a voice message — records are stored and served like other files. */
    @PostMapping("/{id}/voice")
    public ResponseEntity<Void> sendVoice(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        String path = storageService.store(file, "chat-voice");
        communityService.sendVoice(id, SecurityUtils.currentUserId(), path);
        return ResponseEntity.ok().build();
    }

    /** Delete one of the caller's own messages. */
    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(@PathVariable Long messageId) {
        communityService.deleteMessage(messageId, SecurityUtils.currentUserId());
        return ResponseEntity.ok().build();
    }
}
