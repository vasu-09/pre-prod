package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.E2eeDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface E2eeDeviceRepository extends JpaRepository<E2eeDevice, Long> {
    Optional<E2eeDevice> findByUserIdAndDeviceId(Long userId, String deviceId);
    List<E2eeDevice> findByUserId(Long userId);
}