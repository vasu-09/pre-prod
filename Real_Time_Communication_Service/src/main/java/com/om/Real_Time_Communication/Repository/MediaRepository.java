package com.om.Real_Time_Communication.Repository;

import com.om.Real_Time_Communication.models.Media;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public interface MediaRepository extends JpaRepository<Media, Long> {
    /**
     * Delete media records in the given status created before the cutoff.
     * Returns the number of rows removed so a cleanup job can log activity.
     */
    long deleteByStatusAndCreatedAtBefore(String status, Instant createdAt);
}
