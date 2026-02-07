package com.om.backend.Repositories;

import com.om.backend.Model.OneTimePreKeyEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OneTimePreKeyRepository extends JpaRepository<OneTimePreKeyEntity, Long> {

    // Portable JPA way: pessimistic lock the oldest unconsumed row
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
      SELECT p FROM OneTimePreKeyEntity p
      WHERE p.userId = :userId AND p.deviceId = :deviceId AND p.consumed = false
      ORDER BY p.id ASC
      """)
    List<OneTimePreKeyEntity> lockFindOldestUnconsumed(@Param("userId") Long userId,
                                                       @Param("deviceId") int deviceId);

    long countByUserIdAndDeviceIdAndConsumedFalse(Long userId, int deviceId);
}
