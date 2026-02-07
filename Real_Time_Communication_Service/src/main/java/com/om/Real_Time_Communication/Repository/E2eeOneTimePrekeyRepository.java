package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.E2eeOneTimePrekey;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface E2eeOneTimePrekeyRepository extends JpaRepository<E2eeOneTimePrekey, Long> {

    @Query("select p from E2eeOneTimePrekey p " +
            "where p.userId = :userId and p.deviceId = :deviceId and p.consumed = false " +
            "order by p.id asc")
    List<E2eeOneTimePrekey> findAvailable(@Param("userId") Long userId, @Param("deviceId") String deviceId);

    long countByUserIdAndDeviceIdAndConsumedFalse(Long userId, String deviceId);
    void deleteByUserIdAndDeviceId(Long userId, String deviceId);
}
