package com.om.Real_Time_Communication.presence;


import com.om.Real_Time_Communication.Repository.OutboxEventRepository;
import com.om.Real_Time_Communication.config.RabbitConfig;
import com.om.Real_Time_Communication.models.OutboxEvent;
import org.slf4j.Logger; import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Component
public class OutboxPublisher {
    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);

    private final OutboxEventRepository repo;
    private final RabbitTemplate rabbit;

    public OutboxPublisher(OutboxEventRepository repo, RabbitTemplate rabbit) {
        this.repo = repo; this.rabbit = rabbit;
    }

    @Scheduled(fixedDelayString = "${outbox.publish.delay:4000}")
    public void pump() {
        List<OutboxEvent> batch = repo.fetchBatch(Instant.now(), 200);
        for (OutboxEvent ev : batch) {
            try {
                publish(ev);
                markSent(ev.getId());
            } catch (Exception ex) {
                log.warn("Outbox publish failed id={}, attempt={}, err={}", ev.getId(), ev.getAttempts(), ex.toString());
                markFailed(ev.getId());
            }
        }
    }

    private void publish(OutboxEvent ev) {
        String rk = routingKey(ev); // room.<roomId>.message.created
        rabbit.convertAndSend(RabbitConfig.EXCHANGE_EVENTS, rk, ev.getPayload(), msg -> {
            msg.getMessageProperties().setMessageId("obx-" + ev.getId());
            msg.getMessageProperties().setContentType("application/json");
            return msg;
        });
    }

    private String routingKey(OutboxEvent ev) {
        if ("MessageCreated".equals(ev.getEventType())) {
            return "room." + ev.getAggregateId() + ".message.created";
        }
        return "unknown";
    }

    @Transactional
    protected void markSent(Long id) {
        repo.findById(id).ifPresent(e -> {
            e.setStatus("SENT"); e.setPublishedAt(Instant.now()); e.setAttempts(e.getAttempts()+1);
        });
    }

    @Transactional
    protected void markFailed(Long id) {
        repo.findById(id).ifPresent(e -> {
            e.setStatus("PENDING"); // keep pending; backoff is simple here
            e.setAttempts(e.getAttempts()+1);
        });
    }
}
