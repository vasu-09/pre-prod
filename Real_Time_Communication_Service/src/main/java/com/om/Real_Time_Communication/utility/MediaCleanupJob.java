package com.om.Real_Time_Communication.utility;

import com.om.Real_Time_Communication.Repository.MediaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Periodic cleanup to remove abandoned uploads. If a client reserves an upload
 * slot but never calls "complete" the record stays in CREATED status and would
 * never be processed. This job removes such records after a configured TTL.
 */
@Component
public class MediaCleanupJob {
    private static final Logger log = LoggerFactory.getLogger(MediaCleanupJob.class);

    private final MediaRepository repo;
    private final long staleSeconds;

    public MediaCleanupJob(MediaRepository repo,
                           @Value("${media.cleanupAgeSeconds:86400}") long staleSeconds) {
        this.repo = repo;
        this.staleSeconds = staleSeconds;
    }

    @Scheduled(cron = "0 0 * * * *") // hourly
    public void purge() {
        Instant cutoff = Instant.now().minusSeconds(staleSeconds);
        long removed = repo.deleteByStatusAndCreatedAtBefore("CREATED", cutoff);
        if (removed > 0) {
            log.info("Removed {} stale media uploads", removed);
        }
    }
}
