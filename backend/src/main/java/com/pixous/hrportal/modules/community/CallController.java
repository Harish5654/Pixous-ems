package com.pixous.hrportal.modules.community;

import com.pixous.hrportal.modules.user.User;
import com.pixous.hrportal.modules.user.UserRepository;
import com.pixous.hrportal.security.SecurityUtils;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/calls")
@RequiredArgsConstructor
public class CallController {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;
    private final com.pixous.hrportal.modules.notification.NotificationService notificationService;

    @PostMapping("/signal")
    public ResponseEntity<Void> sendSignal(@RequestBody CallSignalRequest request) {
        Long senderId = SecurityUtils.currentUserId();
        User sender = userRepository.findById(senderId).orElseThrow();
        
        CallSignalPayload payload = new CallSignalPayload();
        payload.setSenderId(senderId);
        payload.setSenderName(sender.getName());
        payload.setType(request.getType());
        payload.setData(request.getData());
        
        String destination = "/topic/calls/" + request.getRecipientId();
        log.info("Routing call signal of type {} from {} (ID {}) to destination: {}", 
                request.getType(), sender.getName(), senderId, destination);
        
        messagingTemplate.convertAndSend(destination, payload);

        // Send an in-app push notification when the call is initiated
        if ("calling".equals(request.getType())) {
            try {
                notificationService.createAndPush(
                        request.getRecipientId(),
                        "Incoming Call",
                        sender.getName() + " is calling you...",
                        "CALL",
                        "/chat"
                );
            } catch (Exception e) {
                log.error("Failed to send call notification", e);
            }
        }

        return ResponseEntity.ok().build();
    }

    @Data
    public static class CallSignalRequest {
        private Long recipientId;
        private String type;
        private Object data;
    }

    @Data
    public static class CallSignalPayload {
        private Long senderId;
        private String senderName;
        private String type;
        private Object data;
    }
}
