package com.om.Real_Time_Communication.Repository;


import com.om.Real_Time_Communication.models.OutboxEvent;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    @Query(value = """
        SELECT * FROM outbox_event
         WHERE status = 'PENDING'
           AND occurred_at <= :cutoff
         ORDER BY id
         LIMIT :limit
        """, nativeQuery = true)
    List<OutboxEvent> fetchBatch(@Param("cutoff") Instant cutoff, @Param("limit") int limit);
}