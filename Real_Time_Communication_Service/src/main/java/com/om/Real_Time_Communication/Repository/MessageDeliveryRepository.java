package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.MessageDelivery;
import com.om.Real_Time_Communication.models.MessageDeliveryStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface MessageDeliveryRepository extends JpaRepository<MessageDelivery, Long> {
    Optional<MessageDelivery> findByMsgIdAndUserId(String msgId, Long userId);

    List<MessageDelivery> findByUserIdAndStatusInOrderByCreatedAtAsc(Long userId, Collection<MessageDeliveryStatus> statuses);

    List<MessageDelivery> findByUserIdAndStatusInAndCreatedAtAfterOrderByCreatedAtAsc(Long userId, Collection<MessageDeliveryStatus> statuses, Instant after);
}
