package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.CallRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CallRoomRepository extends JpaRepository<CallRoom, Long> {
    Optional<CallRoom> findByRoomId(String roomId);
}

