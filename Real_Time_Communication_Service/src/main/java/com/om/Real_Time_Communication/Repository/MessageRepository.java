package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    @Query("SELECT m FROM Message m WHERE " +
            "((m.senderId = :userId1 AND m.receiverId = :userId2) " +
            "OR (m.senderId = :userId2 AND m.receiverId = :userId1)) " +
            "ORDER BY m.timestamp ASC")
    List<Message> findConversationBetween(String userId1, String userId2);

    List<Message> findByReceiverIdAndIsGroupMessageTrue(String receiverId);

    java.util.Optional<Message> findByMessageId(String messageId);
}
