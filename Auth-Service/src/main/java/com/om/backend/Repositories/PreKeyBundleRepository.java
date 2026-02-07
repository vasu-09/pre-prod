package com.om.backend.Repositories;

import com.om.backend.Model.PreKeyBundleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PreKeyBundleRepository extends JpaRepository<PreKeyBundleEntity, Long> {
    Optional<PreKeyBundleEntity> findByUserIdAndDeviceId(Long userId, int deviceId);
}