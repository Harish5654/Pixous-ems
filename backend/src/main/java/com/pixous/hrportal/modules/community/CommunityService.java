package com.pixous.hrportal.modules.community;

import com.pixous.hrportal.modules.user.User;
import com.pixous.hrportal.modules.user.UserRepository;
import com.pixous.hrportal.modules.user.dto.UserSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommunityService {

    /** Prefix used to name the hidden 2-member rooms that back private 1:1 chats. */
    private static final String DM_PREFIX = "__dm__";

    private final CommunityGroupRepository groupRepository;
    private final CommunityMemberRepository memberRepository;
    private final CommunityMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public CommunityDTOs.GroupResponse createGroup(CommunityDTOs.CreateGroupRequest request, Long adminId) {
        if (request.getName() != null && request.getName().startsWith(DM_PREFIX)) {
            throw new IllegalArgumentException("Invalid community name.");
        }
        if (groupRepository.existsByNameIgnoreCase(request.getName())) {
            throw new IllegalArgumentException("A community group with this name already exists.");
        }

        User admin = userRepository.findById(adminId).orElseThrow();

        CommunityGroup group = new CommunityGroup();
        group.setName(request.getName());
        group.setDescription(request.getDescription());
        group.setCreatedBy(admin);
        group.setAnnouncement(request.isAnnouncement());

        CommunityGroup saved = groupRepository.save(group);

        // Auto-add creator as member
        CommunityMember member = new CommunityMember();
        member.setCommunity(saved);
        member.setUser(admin);
        memberRepository.save(member);

        return new CommunityDTOs.GroupResponse(
                saved.getId(), saved.getName(), saved.getDescription(), adminId, LocalDateTime.now(), saved.isAnnouncement()
        );
    }

    @Transactional
    public void addMember(Long communityId, Long userId) {
        CommunityGroup group = groupRepository.findById(communityId).orElseThrow();
        User user = userRepository.findById(userId).orElseThrow();

        CommunityMember member = new CommunityMember();
        member.setCommunity(group);
        member.setUser(user);

        memberRepository.save(member);
    }

    @Transactional
    public void removeMember(Long communityId, Long userId) {
        memberRepository.deleteByCommunity_IdAndUser_Id(communityId, userId);
    }

    /**
     * Find-or-create a private 1:1 conversation between the current user and another user.
     * These rooms are hidden from the admin community listing and only ever have two members.
     */
    @Transactional
    public CommunityDTOs.GroupResponse openDirect(Long currentUserId, Long otherUserId) {
        if (otherUserId == null || otherUserId.equals(currentUserId)) {
            throw new IllegalArgumentException("Cannot start a chat with yourself.");
        }
        User me = userRepository.findById(currentUserId).orElseThrow();
        User other = userRepository.findById(otherUserId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found."));

        String name = directName(currentUserId, otherUserId);
        CommunityGroup group = groupRepository.findByName(name).orElseGet(() -> {
            CommunityGroup g = new CommunityGroup();
            g.setName(name);
            g.setDescription("");
            g.setCreatedBy(me);
            g.setAnnouncement(false);
            return groupRepository.save(g);
        });

        // Idempotently ensure exactly the two participants are members.
        ensureMember(group, me);
        ensureMember(group, other);

        return toDirectResponse(group, other);
    }

    @Transactional(readOnly = true)
    public List<CommunityDTOs.GroupResponse> getUserCommunities(Long userId) {
        return groupRepository.findByMemberUserId(userId).stream()
                .map(g -> {
                    if (isDirect(g)) {
                        User partner = memberRepository.findByCommunity_Id(g.getId()).stream()
                                .map(CommunityMember::getUser)
                                .filter(u -> !u.getId().equals(userId))
                                .findFirst()
                                .orElse(null);
                        if (partner == null) return null; // orphaned DM room — hide it
                        return toDirectResponse(g, partner);
                    }
                    return new CommunityDTOs.GroupResponse(
                            g.getId(), g.getName(), g.getDescription(), g.getCreatedBy().getId(), g.getCreatedAt(), g.isAnnouncement()
                    );
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CommunityDTOs.GroupResponse> getAllCommunities() {
        // Never expose the private 1:1 rooms in the admin community listing.
        return groupRepository.findAll().stream()
                .filter(g -> !isDirect(g))
                .map(g -> new CommunityDTOs.GroupResponse(
                        g.getId(), g.getName(), g.getDescription(), g.getCreatedBy().getId(), g.getCreatedAt(), g.isAnnouncement()
                )).collect(Collectors.toList());
    }

    /** Enabled users (excluding the requester) that can be reached for a private chat. */
    @Transactional(readOnly = true)
    public List<UserSummary> getContacts(Long currentUserId) {
        return userRepository.findByEnabledTrue().stream()
                .filter(u -> !u.getId().equals(currentUserId))
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteGroup(Long communityId) {
        // Manually delete children first to avoid foreign key constraint issues if DB cascade is missing
        messageRepository.deleteAll(messageRepository.findByCommunityIdOrderBySentAtAsc(communityId));
        memberRepository.findByCommunity_Id(communityId).forEach(memberRepository::delete);
        groupRepository.deleteById(communityId);
    }

    @Transactional(readOnly = true)
    public List<UserSummary> getMembers(Long communityId, Long requesterId) {
        assertMember(communityId, requesterId);
        return memberRepository.findByCommunity_Id(communityId).stream()
                .map(cm -> toSummary(cm.getUser()))
                .toList();
    }

    @Transactional
    public void sendMessage(Long communityId, Long senderId, String content) {
        assertMember(communityId, senderId);
        CommunityGroup group = groupRepository.findById(communityId).orElseThrow();
        User sender = userRepository.findById(senderId).orElseThrow();

        // Check announcement channel permissions
        if (group.isAnnouncement()) {
            boolean isAdminOrHr = sender.getRoles().stream()
                    .anyMatch(r -> r.getCode().equals("SUPER_ADMIN") || r.getCode().equals("IT_HR"));
            if (!isAdminOrHr) {
                throw new SecurityException("Only administrators can post announcements to this channel.");
            }
        }

        CommunityMessage msg = new CommunityMessage();
        msg.setCommunity(group);
        msg.setSender(sender);
        msg.setContent(content);

        CommunityMessage saved = messageRepository.save(msg);

        // Broadcast directly to WebSocket destination
        messagingTemplate.convertAndSend("/topic/community/" + communityId, toPayload(saved));
    }

    /** Send a voice message (audio already stored; {@code audioPath} is its served path). */
    @Transactional
    public void sendVoice(Long communityId, Long senderId, String audioPath) {
        assertMember(communityId, senderId);
        CommunityGroup group = groupRepository.findById(communityId).orElseThrow();
        User sender = userRepository.findById(senderId).orElseThrow();

        if (group.isAnnouncement()) {
            boolean isAdminOrHr = sender.getRoles().stream()
                    .anyMatch(r -> r.getCode().equals("SUPER_ADMIN") || r.getCode().equals("IT_HR"));
            if (!isAdminOrHr) {
                throw new SecurityException("Only administrators can post announcements to this channel.");
            }
        }

        CommunityMessage msg = new CommunityMessage();
        msg.setCommunity(group);
        msg.setSender(sender);
        msg.setContent("🎤 Voice message");
        msg.setAudioPath(audioPath);
        CommunityMessage saved = messageRepository.save(msg);

        messagingTemplate.convertAndSend("/topic/community/" + communityId, toPayload(saved));
    }

    /** Delete a message. Only its own sender may delete it. Broadcasts a removal signal. */
    @Transactional
    public void deleteMessage(Long messageId, Long requesterId) {
        CommunityMessage msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found."));
        if (msg.getSender() == null || !msg.getSender().getId().equals(requesterId)) {
            throw new SecurityException("You can only delete your own messages.");
        }
        Long communityId = msg.getCommunity().getId();
        messageRepository.delete(msg);

        CommunityDTOs.ChatMessagePayload signal = new CommunityDTOs.ChatMessagePayload();
        signal.setMessageId(messageId);
        signal.setCommunityId(communityId);
        signal.setDeleted(true);
        messagingTemplate.convertAndSend("/topic/community/" + communityId, signal);
    }

    @Transactional(readOnly = true)
    public List<CommunityDTOs.ChatMessagePayload> getMessages(Long communityId, Long requesterId) {
        assertMember(communityId, requesterId);
        return messageRepository.findByCommunityIdOrderBySentAtAsc(communityId).stream()
                .map(this::toPayload).collect(Collectors.toList());
    }

    private CommunityDTOs.ChatMessagePayload toPayload(CommunityMessage msg) {
        CommunityDTOs.ChatMessagePayload p = new CommunityDTOs.ChatMessagePayload();
        p.setMessageId(msg.getId());
        p.setCommunityId(msg.getCommunity().getId());
        p.setSenderId(msg.getSender().getId());
        p.setSenderName(msg.getSender().getName());
        p.setContent(msg.getContent());
        p.setAudioPath(msg.getAudioPath());
        p.setSentAt(msg.getSentAt() != null ? msg.getSentAt() : LocalDateTime.now());
        p.setDeleted(false);
        return p;
    }

    // ---- helpers ----

    /** Guard: the requester must belong to the conversation. Keeps 1:1 chats private, even from admins. */
    private void assertMember(Long communityId, Long requesterId) {
        if (requesterId == null || !memberRepository.isMember(communityId, requesterId)) {
            throw new SecurityException("You are not a member of this conversation.");
        }
    }

    private void ensureMember(CommunityGroup group, User user) {
        if (!memberRepository.isMember(group.getId(), user.getId())) {
            CommunityMember m = new CommunityMember();
            m.setCommunity(group);
            m.setUser(user);
            memberRepository.save(m);
        }
    }

    private static String directName(Long a, Long b) {
        long min = Math.min(a, b);
        long max = Math.max(a, b);
        return DM_PREFIX + min + "_" + max;
    }

    private static boolean isDirect(CommunityGroup g) {
        return g.getName() != null && g.getName().startsWith(DM_PREFIX);
    }

    private CommunityDTOs.GroupResponse toDirectResponse(CommunityGroup group, User partner) {
        return new CommunityDTOs.GroupResponse(
                group.getId(),
                partner.getName(),
                partner.getEmployeeCode(),
                group.getCreatedBy().getId(),
                group.getCreatedAt() != null ? group.getCreatedAt() : LocalDateTime.now(),
                false,               // isAnnouncement
                true,                // direct
                partner.getId(),
                partner.getPhotoPath()
        );
    }

    private UserSummary toSummary(User u) {
        return new UserSummary(
                u.getId(),
                u.getEmployeeCode(),
                u.getName(),
                u.getEmail(),
                u.getPhone(),
                u.getIndustry(),
                u.getDepartmentId(),
                u.getProfileStatus(),
                u.getPhotoPath(),
                u.getDob(),
                u.getRoles().stream().map(com.pixous.hrportal.modules.user.Role::getCode).toList()
        );
    }
}
