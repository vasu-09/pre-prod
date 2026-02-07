package com.om.Notification_Service.repository;



import com.om.Notification_Service.models.UserDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserDeviceRepository extends JpaRepository<UserDevice, Long> {
    List<UserDevice> findByUserId(Long userId);
}
