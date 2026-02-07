package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.ChatRoom;
import com.om.Real_Time_Communication.models.ChatRoomParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomParticipantRepository extends JpaRepository<ChatRoomParticipant,Long> {
    List<ChatRoomParticipant> findByChatRoom(ChatRoom chatRoom);
    List<ChatRoomParticipant> findByUserId(Long userId);

    Optional<ChatRoomParticipant> findByUserIdAndChatRoom(Long userId, ChatRoom room);

    @Modifying
    @Transactional
    @Query("delete from ChatRoomParticipant p " +
            "where p.userId = :userId and p.chatRoom.id = :roomId")
    void deleteByUserIdAndChatRoom(@Param("userId") Long userId, @Param("roomId") Long roomId);


    @Query("""
        select case when count(p) > 0 then true else false end
          from ChatRoomParticipant p
         where p.chatRoom.id = :roomId
           and p.userId      = :userId
    """)
    boolean existsByRoomIdAndUserId(@Param("roomId") Long roomId,
                                    @Param("userId") Long userId);

    @Query("select count(p) from ChatRoomParticipant p where p.chatRoom.id = :roomId")
    long countByRoomId(@Param("roomId") Long roomId);


    @Query("select p.userId from ChatRoomParticipant p where p.chatRoom.id = :roomId")
    List<Long> findUserIdsByRoomId(@Param("roomId") Long roomId);


    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("""
     update ChatRoomParticipant p
        set p.lastReadMessageId = :messageId,
            p.lastReadAt = CURRENT_TIMESTAMP
      where p.chatRoom.id = :roomId
        and p.userId      = :userId
  """)
    int updateLastRead(@Param("roomId") Long roomId,
                       @Param("userId") Long userId,
                       @Param("messageId") String messageId);

    @Query("select p.chatRoom.id from ChatRoomParticipant p where p.userId = :userId and (p.hidden = false or p.hidden is null)")
    List<Long> findChatRoomIdsByUserId(@Param("userId") Long userId);
}
