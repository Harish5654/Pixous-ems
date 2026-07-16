package com.pixous.hrportal.modules.community;

import com.pixous.hrportal.modules.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "community_messages")
@Getter
@Setter
public class CommunityMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "community_id", nullable = false)
    private CommunityGroup community;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /** For voice messages: served path of the recorded audio clip. Null for text. */
    @Column(name = "audio_path", length = 255)
    private String audioPath;

    @Column(name = "sent_at", insertable = false, updatable = false)
    private LocalDateTime sentAt;
}
