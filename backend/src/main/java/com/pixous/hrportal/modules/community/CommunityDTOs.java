package com.pixous.hrportal.modules.community;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

public class CommunityDTOs {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessagePayload {
        private Long messageId;
        private Long communityId;
        private Long senderId;
        private String senderName;
        private String content;
        private LocalDateTime sentAt;
        /** Voice message audio path (null for plain text). */
        private String audioPath;
        /** True when this payload signals that the message was deleted. */
        private boolean deleted;
    }

    @Data
    public static class CreateGroupRequest {
        private String name;
        private String description;
        private boolean isAnnouncement;
    }

    @Data
    public static class AddMemberRequest {
        private Long userId;
    }
    
    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class GroupResponse {
        private Long id;
        private String name;
        private String description;
        private Long createdBy;
        private LocalDateTime createdAt;
        private boolean isAnnouncement;
        // Direct (1:1) chat metadata — null / false for normal community groups.
        private boolean direct;
        private Long partnerId;
        private String partnerPhotoPath;

        // Backward-compatible constructor for normal (non-direct) community groups.
        public GroupResponse(Long id, String name, String description, Long createdBy,
                             LocalDateTime createdAt, boolean isAnnouncement) {
            this(id, name, description, createdBy, createdAt, isAnnouncement, false, null, null);
        }
    }
}
