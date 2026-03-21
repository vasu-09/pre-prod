package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.E2eeDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface E2eeDeviceRepository extends JpaRepository<E2eeDevice, Long> {
    Optional<E2eeDevice> findByUserIdAndDeviceId(Long userId, String deviceId);
    List<E2eeDevice> findByUserId(Long userId);
    List<E2eeDevice> findByUserIdAndStatusIgnoreCase(Long userId, String status);

    @Modifying
    @Query("""
        update E2eeDevice d
           set d.status = 'INACTIVE',
               d.revokedAt = :now
         where d.userId = :userId
           and d.deviceId <> :currentDeviceId
           and upper(d.status) = 'ACTIVE'
    """)
    int deactivateOtherDevices(@Param("userId") Long userId,
                               @Param("currentDeviceId") String currentDeviceId,
                               @Param("now") Instant now);


    @Modifying
    @Query("""
        update E2eeDevice d
           set d.registeredAt = coalesce(d.registeredAt, :now),
               d.historyVisibleFrom = coalesce(d.historyVisibleFrom, coalesce(d.registeredAt, :now)),
               d.status = coalesce(d.status, 'ACTIVE'),
               d.deviceEpoch = coalesce(d.deviceEpoch, 1)
         where d.registeredAt is null
            or d.historyVisibleFrom is null
            or d.status is null
            or d.deviceEpoch is null
    """)
    int backfillLegacyRows(@Param("now") Instant now);
}