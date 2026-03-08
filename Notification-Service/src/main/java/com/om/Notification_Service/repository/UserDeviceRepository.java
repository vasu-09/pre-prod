package com.om.Notification_Service.repository;



import com.om.Notification_Service.models.UserDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserDeviceRepository extends JpaRepository<UserDevice, Long> {
    List<UserDevice> findByUserId(Long userId);

    Optional<UserDevice> findByUserIdAndSessionId(Long userId, String sessionId);

    void deleteByUserIdAndFcmToken(Long userId, String fcmToken);
}
