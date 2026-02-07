package com.om.Real_Time_Communication.utility;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.om.Real_Time_Communication.config.RabbitConfig;
import com.om.Real_Time_Communication.dto.MessageCreated;
import com.om.Real_Time_Communication.dto.SearchMessageDoc;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger; import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class MessageSearchIndexer {
    private static final Logger log = LoggerFactory.getLogger(MessageSearchIndexer.class);

    private final ObjectMapper om;
    private final SearchWriter searchWriter;          // OpenSearch/Elasticsearch writer (bulk)
    private final StringRedisTemplate redis;          // Redis recents

    public MessageSearchIndexer(ObjectMapper om, SearchWriter searchWriter, StringRedisTemplate redis) {
        this.om = om;
        this.searchWriter = searchWriter;
        this.redis = redis;
    }

    @RabbitListener(queues = RabbitConfig.Q_READMODEL_MSG_CREATED)
    public void onMessageCreated(String payload) throws Exception {
        MessageCreated ev = om.readValue(payload, MessageCreated.class);

        // 1) OpenSearch/Elasticsearch (async bulk)
        SearchMessageDoc doc = SearchMessageDoc.from(ev);
        searchWriter.enqueue(doc);

        // 2) Redis secondary indexes (MVP / fast recents)
        // Per-room sorted set of recent messageIds
        String zKey = "room:idx:" + ev.roomId;
        long score = ev.serverTs == null ? Instant.now().toEpochMilli() : ev.serverTs.toEpochMilli();
        redis.opsForZSet().add(zKey, ev.messageId, score);
        // Optional cap: keep only last N (e.g., 10k)
        Long size = redis.opsForZSet().zCard(zKey);
        if (size != null && size > 10_000) {
            redis.opsForZSet().removeRange(zKey, 0, size - 10_000);
        }

        // For non-E2EE only, cache a tiny searchable body blob (MVP)
        if (!ev.e2ee && ev.body != null && !ev.body.isBlank()) {
            String bodyKey = "msg:body:" + ev.messageId;
            // keep short (e.g., 2 KB) to avoid memory blowups
            String truncated = ev.body.length() > 2000 ? ev.body.substring(0, 2000) : ev.body;
            redis.opsForValue().set(bodyKey, truncated);
            // Optional TTL: recent-only index
            redis.expire(bodyKey, java.time.Duration.ofDays(7));
        }
    }
}
