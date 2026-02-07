package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.CallSession;
import com.om.Real_Time_Communication.models.CallState;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface CallSessionRepository extends JpaRepository<CallSession, Long> {


    Optional<CallSession> findByIdAndStateNot(Long id, CallState ended);
    @Query("select c from CallSession c where c.state in ('INVITE_SENT','RINGING') and c.createdAt < :cutoff")
    List<CallSession> findStaleInvites(@Param("cutoff") Instant cutoff);

    @Query("select case when count(c) > 0 then true else false end from CallSession c " +
            "where (c.initiatorId = :userId or concat(',', c.calleeIdsCsv, ',') like :member) " +
            "and c.state in ('INVITE_SENT','RINGING','ANSWERED')")
    boolean existsActiveCallForUser(@Param("userId") Long userId, @Param("member") String member);


    @Query("select c from CallSession c " +
            "where (:roomId is null or c.roomId = :roomId) " +
            "and (:state is null or c.state = :state) " +
            "and (:since is null or c.createdAt >= :since) " +
            "and (:until is null or c.createdAt <= :until) " +
            "and ( :userId is null or c.initiatorId = :userId " +
            "   or concat(',', c.calleeIdsCsv, ',') like concat('%,', cast(:userId as string), ',%') )")
    Page<CallSession> searchHistory(@Param("userId") Long userId,
                                    @Param("roomId") Long roomId,
                                    @Param("state") CallState state,
                                    @Param("since") Instant since,
                                    @Param("until") Instant until,
                                    Pageable pageable);

    @Query("""
      select c from CallSession c
      where (c.initiatorId = :userId or concat(',', c.calleeIdsCsv, ',') like concat('%,', cast(:userId as string), ',%'))
        and (:beforeTs is null or (c.createdAt < :beforeTs or (c.createdAt = :beforeTs and c.id < :beforeId)))
      order by c.createdAt desc, c.id desc
    """)
    List<CallSession> pageHistory(@Param("userId") Long userId,
                                  @Param("beforeTs") Instant beforeTs,
                                  @Param("beforeId") Long beforeId,
                                  Pageable pageable);
}
