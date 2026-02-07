package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.UserRoomStateRepository;
import com.om.Real_Time_Communication.models.UserRoomState;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Instant;

@Service
public class ReadReceiptService {

    private final UserRoomStateRepository repo;
    private final StringRedisTemplate redis;

    public ReadReceiptService(UserRoomStateRepository repo, StringRedisTemplate redis) {
        this.repo = repo;
        this.redis = redis;
    }

    @Transactional
    public UserRoomState updateLastRead(Long userId, Long roomId, String lastReadMessageId) {
        UserRoomState s = repo.findByUserIdAndRoomId(userId, roomId)
                .orElseGet(() -> {
                    UserRoomState n = new UserRoomState();
                    n.setUserId(userId); n.setRoomId(roomId);
                    return n;
                });
        s.setLastReadMessageId(lastReadMessageId);
        s.setLastReadAt(Instant.now());
        UserRoomState saved = repo.save(s);
        // clear unread counter in Redis so badge counts stay accurate
        redis.opsForHash().put("room:unread:" + roomId, String.valueOf(userId), "0");

        return saved;
    }
}
