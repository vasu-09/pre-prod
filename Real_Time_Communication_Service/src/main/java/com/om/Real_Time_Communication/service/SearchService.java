package com.om.Real_Time_Communication.service;

import co.elastic.clients.elasticsearch._types.FieldValue;
import com.om.Real_Time_Communication.dto.SearchMessageDoc;
import io.micrometer.common.lang.Nullable;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service

public class SearchService {
    private final ElasticsearchOperations es;
    private final org.springframework.data.redis.core.StringRedisTemplate redis;

    public SearchService(ElasticsearchOperations es, StringRedisTemplate redis) {
        this.es = es;
        this.redis = redis;
    }

    public java.util.List<SearchMessageDoc> searchAll(Long userId, java.util.List<Long> roomIds, String query, int limit) {
        if (roomIds == null || roomIds.isEmpty()) return java.util.List.of();

        // build terms values for roomIds
        java.util.List<FieldValue> roomVals = roomIds.stream()
                .map(id -> FieldValue.of(id.toString()))
                .toList();

        NativeQuery nq = NativeQuery.builder()
                .withQuery(q -> q.bool(b -> b
                        .filter(f -> f.terms(t -> t.field("roomId").terms(v -> v.value(roomVals))))
                        .must(m -> {
                            if (query == null || query.isBlank()) return m.matchAll(ma -> ma);
                            return m.match(mm -> mm.field("text").query(query));
                        })
                ))
                .withPageable(PageRequest.of(0, Math.max(1, Math.min(limit, 200))))
                .build();

        SearchHits<SearchMessageDoc> hits = es.search(nq, SearchMessageDoc.class, IndexCoordinates.of(SearchMessageDoc.INDEX));
        return hits.get().map(SearchHit::getContent).toList();
    }

    public java.util.List<RecentHit> searchInRoomMvp(Long roomId, String query, int limit) {
        String zKey = "room:idx:" + roomId;
        var ids = redis.opsForZSet().reverseRange(zKey, 0, 2000);
        if (ids == null || ids.isEmpty()) return java.util.List.of();

        String q = (query == null) ? "" : query.toLowerCase(java.util.Locale.ROOT);
        java.util.List<RecentHit> out = new java.util.ArrayList<>();
        for (String mid : ids) {
            String body = redis.opsForValue().get("msg:body:" + mid);
            if (body == null) continue;
            if (q.isBlank() || body.toLowerCase(java.util.Locale.ROOT).contains(q)) {
                out.add(new RecentHit(roomId, mid, body));
                if (out.size() >= limit) break;
            }
        }
        return out;
    }

    public static record RecentHit(Long roomId, String messageId, String snippet) {}
}