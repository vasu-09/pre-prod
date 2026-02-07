package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.ChatMessageRepository;
import com.om.Real_Time_Communication.Repository.ChatRoomParticipantRepository;
import com.om.Real_Time_Communication.models.ChatMessage;
import com.om.Real_Time_Communication.utility.MessageCursor;
import io.micrometer.common.lang.Nullable;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;


import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

@Service

public class MessagePagingService {

    private final ChatMessageRepository repo;

    private final ChatRoomParticipantRepository partrepo;
    private final StringRedisTemplate redis;

    public MessagePagingService(ChatMessageRepository repo, ChatRoomParticipantRepository partrepo, StringRedisTemplate redis) {
        this.repo = repo;
        this.partrepo = partrepo;
        this.redis = redis;
    }

    @Transactional
    public void markRead(Long roomId, Long userId, String messageId) {
        partrepo.updateLastRead(roomId, userId, messageId);
        // clear unread counter in Redis
        redis.opsForHash().put("room:unread:" + roomId, String.valueOf(userId), "0");

    }

    public List<ChatMessage> list(Long roomId, Instant beforeTs, Long beforeId, int limit) {
        int lim = Math.min(Math.max(limit, 1), 200);
        if (beforeTs == null || beforeId == null) {
            return repo.newest(roomId, PageRequest.of(0, lim));
        }
        return repo.pageBackward(roomId, beforeTs, beforeId, PageRequest.of(0, lim));
        // client uses the last item’s (serverTs,id) as next cursor
    }

    public PageDto pageForward(Long roomId, String cursor, int limit) {
        java.util.AbstractMap.SimpleEntry<Instant, Long> c =
                (cursor == null) ? null : MessageCursor.decode(cursor);
        Timestamp ts = (c == null) ? new Timestamp(0) : Timestamp.from(c.getKey());
        Long id = (c == null) ? 0L : c.getValue();

        List<ChatMessage> rows = repo.pageForward(roomId, ts, id, limit + 1);
        boolean hasMore = rows.size() > limit;
        if (hasMore) rows = rows.subList(0, limit);

        String next = rows.isEmpty() ? null :
                MessageCursor.encode(rows.get(rows.size()-1).getServerTs(), rows.get(rows.size()-1).getId());

        return new PageDto(rows, next, null);
    }

    public PageDto pageBackward(Long roomId, String cursor, int limit) {
        if (cursor == null) throw new IllegalArgumentException("cursor required for backward paging");
        java.util.AbstractMap.SimpleEntry<Instant, Long> c = MessageCursor.decode(cursor);
        List<ChatMessage> rows = repo.pageBackward(roomId, Timestamp.from(c.getKey()), c.getValue(), limit + 1);
        boolean hasMore = rows.size() > limit;
        if (hasMore) rows = rows.subList(0, limit);
        // we fetched DESC; return ASC
        java.util.Collections.reverse(rows);

        String prev = rows.isEmpty() ? null :
                MessageCursor.encode(rows.get(0).getServerTs(), rows.get(0).getId());

        return new PageDto(rows, null, prev);
    }

    public static final class PageDto {
        public final List<ChatMessage> data;
        public final String next; // for forward
        public final String prev; // for backward
        public PageDto(List<ChatMessage> data, String next, String prev) {
            this.data = data; this.next = next; this.prev = prev;
        }
    }
}

