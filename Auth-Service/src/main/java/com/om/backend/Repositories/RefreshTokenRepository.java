package com.om.backend.Repositories;

import com.om.backend.Model.RefreshTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, Long> {
    Optional<RefreshTokenEntity> findByTokenHashAndRevokedFalse(String tokenHash);
    long deleteByUserIdAndDeviceIdAndRegistrationId(Long userId, int deviceId, int registrationId);
    long deleteByUserIdAndExpiresAtBefore(Long userId, Instant cutOff);
}