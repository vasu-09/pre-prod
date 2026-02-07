package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.UserBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserBlockRepository extends JpaRepository<UserBlock, Long> {

    Optional<UserBlock> findByBlockerIdAndBlockedId(String blockerId, String blockedId);

    @Query("SELECT ub FROM UserBlock ub WHERE " +
            "(ub.blockerId = :userA AND ub.blockedId = :userB OR ub.blockerId = :userB AND ub.blockedId = :userA) " +
            "AND ub.status = 'BLOCKED'")
    List<UserBlock> findActiveBlockBetween(String userA, String userB);
}

