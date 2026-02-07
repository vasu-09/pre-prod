package com.om.Real_Time_Communication.utility;

import com.om.Real_Time_Communication.Repository.MediaRepository;
import com.om.Real_Time_Communication.models.Media;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

/**
 * Test stub that simulates media processing.
 * Updates the Media entity without touching external systems.
 */
@Component
@Profile("test")

public class StubMediaWorker {

    private final MediaRepository repo;

    public StubMediaWorker(MediaRepository repo) {
        this.repo = repo;
    }

    @RabbitListener(queues = "q.media.process")
    @Transactional
    public void onProcess(Map<String,Object> msg) {
        Long mediaId = ((Number) msg.get("mediaId")).longValue();
        Media m = repo.findById(mediaId).orElseThrow();
        m.setStatus("READY");
        m.setThumbObject(m.getGcsObject() + "-thumb");
        m.setUpdatedAt(Instant.now());
        repo.save(m);
    }
}