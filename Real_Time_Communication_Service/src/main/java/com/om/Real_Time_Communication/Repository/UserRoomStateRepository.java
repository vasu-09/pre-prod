package com.om.Real_Time_Communication.Repository;


import com.om.Real_Time_Communication.models.UserRoomState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRoomStateRepository extends JpaRepository<UserRoomState, Long> {
    Optional<UserRoomState> findByUserIdAndRoomId(Long userId, Long roomId);
}
