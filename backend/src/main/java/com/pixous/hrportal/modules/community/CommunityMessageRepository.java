package com.pixous.hrportal.modules.community;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CommunityMessageRepository extends JpaRepository<CommunityMessage, Long> {
    List<CommunityMessage> findByCommunityIdOrderBySentAtAsc(Long communityId);
    void deleteBySender_Id(Long senderId);
}
