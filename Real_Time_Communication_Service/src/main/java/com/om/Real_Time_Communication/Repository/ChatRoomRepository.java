package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.ChatRoom;
import com.om.Real_Time_Communication.models.ChatRoomType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    Optional<ChatRoom> findByRoomId(String roomId);

    @Query("SELECT r.name FROM ChatRoom r WHERE r.id = :roomId")
    String findNameByRoomId(@Param("roomId") String roomId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ChatRoom r where r.directPairKey = :pairKey and r.type = :type")
    Optional<ChatRoom> findDirectRoomForUpdate(
            @Param("pairKey") String pairKey,
            @Param("type") ChatRoomType type
    );
    Optional<ChatRoom> findByDirectPairKeyAndType(String pairKey, ChatRoomType type);
    static String buildDirectPairKey(Long userA, Long userB) {
        if (userA == null || userB == null) {
            throw new IllegalArgumentException("Both user ids are required");
        }
        long first = Math.min(userA, userB);
        long second = Math.max(userA, userB);
        return first + ":" + second;
    }
}
