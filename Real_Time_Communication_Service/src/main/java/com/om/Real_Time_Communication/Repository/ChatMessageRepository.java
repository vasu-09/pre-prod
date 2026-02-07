package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;


import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    Optional<ChatMessage> findByRoomIdAndMessageId(Long roomId, String messageId);
    Optional<ChatMessage> findByMessageId(String messageId);


    @Query(value =
            "SELECT * FROM chat_message " +
                    "WHERE room_id = :roomId " +
                    "  AND (created_at > :cursorCreatedAt " +
                    "       OR (created_at = :cursorCreatedAt AND id > :cursorId)) " +
                    "ORDER BY created_at ASC, id ASC " +
                    "LIMIT :limit",
            nativeQuery = true)
    List<ChatMessage> pageForward(@Param("roomId") Long roomId,
                                  @Param("cursorCreatedAt") Timestamp cursorCreatedAt,
                                  @Param("cursorId") Long cursorId,
                                  @Param("limit") int limit);

    @Query(value =
            "SELECT * FROM chat_message " +
                    "WHERE room_id = :roomId " +
                    "  AND (created_at < :cursorCreatedAt " +
                    "       OR (created_at = :cursorCreatedAt AND id < :cursorId)) " +
                    "ORDER BY created_at DESC, id DESC " +
                    "LIMIT :limit",
            nativeQuery = true)
    List<ChatMessage> pageBackward(@Param("roomId") Long roomId,
                                   @Param("cursorCreatedAt") Timestamp cursorCreatedAt,
                                   @Param("cursorId") Long cursorId,
                                   @Param("limit") int limit);

    // newest N (when no cursor provided)
    @Query("""
      select m from ChatMessage m
      where m.roomId = :roomId
      order by m.serverTs desc, m.id desc
    """)
    List<ChatMessage> newest(@Param("roomId") Long roomId, org.springframework.data.domain.Pageable pageable);

    // page backward (older): (ts,id) < (beforeTs,beforeId)
    @Query("""
      select m from ChatMessage m
      where m.roomId = :roomId
        and (m.serverTs < :beforeTs or (m.serverTs = :beforeTs and m.id < :beforeId))
      order by m.serverTs desc, m.id desc
    """)
    List<ChatMessage> pageBackward(
            @Param("roomId") Long roomId,
            @Param("beforeTs") Instant beforeTs,
            @Param("beforeId") Long beforeId,
            org.springframework.data.domain.Pageable pageable
    );


}
