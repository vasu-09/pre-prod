package com.om.Real_Time_Communication.presence;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

@Component
public class ReadModelUpdater {
    private static final Logger log = LoggerFactory.getLogger(ReadModelUpdater.class);
    private final StringRedisTemplate redis;

    public ReadModelUpdater(StringRedisTemplate redis) { this.redis = redis; }

    // Bind this queue to exchange with routing key pattern "room.*.message.created"
    // Queue declaration can be via config or infra-as-code; for demo, assume queue exists.
//    @RabbitListener(queues = "rtc.readmodel.message.created")
    public void onMessageCreated(String payload, String rk) {
//                                 @Header(AmqpHeaders.RECEIVED_ROUTING_KEY) String rk) {
        // payload is MessageCreated JSON from outbox; we’ll just set last and bump unread
        try {
            // Extract roomId from routing key: room.<roomId>.message.created
            String[] parts = rk.split("\\.");
            Long roomId = Long.valueOf(parts[1]);

            // 1) last message (store as JSON string for quick API reads)
            String lastKey = "room:last:" + roomId;
            redis.opsForValue().set(lastKey, payload);

            // 2) unread counts: increment for all members except sender
            // If you have a membership set in Redis:
            String membersKey = "room:members:" + roomId;
            var members = redis.opsForSet().members(membersKey);
            Long senderId = extractSenderId(payload); // tiny parse; see helper below
            if (members != null) {
                for (String uid : members) {
                    if (uid.equals(String.valueOf(senderId))) continue;
                    redis.opsForHash().increment("room:unread:"+roomId, uid, 1);
                }
            }
        } catch (Exception e) {
            log.warn("readmodel update failed: {}", e.toString());
            // Let RabbitMQ redeliver or configure DLQ; idempotent anyway
            throw e;
        }
    }

    private Long extractSenderId(String json) {
        // naive fast path (avoid full JSON deserialize)
        // expects: ..."senderId":123,...
        int i = json.indexOf("\"senderId\"");
        if (i < 0) return -1L;
        int c = json.indexOf(":", i);
        int j = c+1;
        while (j < json.length() && Character.isWhitespace(json.charAt(j))) j++;
        int k = j;
        while (k < json.length() && Character.isDigit(json.charAt(k))) k++;
        return Long.parseLong(json.substring(j, k));
    }
}
