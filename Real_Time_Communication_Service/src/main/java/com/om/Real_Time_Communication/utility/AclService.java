package com.om.Real_Time_Communication.utility;

import com.om.Real_Time_Communication.Repository.ChatRoomParticipantRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

@Service
public class AclService {
    private final StringRedisTemplate redis;
    private final ChatRoomParticipantRepository repo;
    private final Duration ttl = Duration.ofHours(1);

    public AclService(StringRedisTemplate redis, ChatRoomParticipantRepository repo) {
        this.redis = redis;
        this.repo = repo;
    }

    private String roomMembersKey(Long roomId) {
        return "room:members:" + roomId;
    }


    public boolean canSubscribe(Long userId, Long roomId) {
        String key = roomMembersKey(roomId);
        String uid = String.valueOf(userId);

        try {
            Boolean ok = redis.opsForSet().isMember(key, uid);
            if (Boolean.TRUE.equals(ok)) {
                redis.expire(key, ttl);
                return true;
            }
        } catch (Exception ignored) {
            // Fallback to DB on Redis errors.
        }

        boolean allowed = repo.existsByRoomIdAndUserId(roomId, userId);
        if (!allowed) {
            return false;
        }

        try {
            List<Long> ids = repo.findUserIdsByRoomId(roomId);
            if (ids != null && !ids.isEmpty()) {
                String[] vals = ids.stream().map(String::valueOf).toArray(String[]::new);
                redis.delete(key);
                redis.opsForSet().add(key, vals);
                redis.expire(key, ttl);
            }
        } catch (Exception ignored) {
            // Do not block valid subscriptions on cache refresh issues.
        }

        return true;

    }

    public boolean canPublish(Long userId, Long roomId) {
        // same as subscribe or stricter if you have roles (owners/mods)
        return canSubscribe(userId, roomId);
    }
    // bump version on membership change
    public void onMembershipChanged(Long roomId) {
        redis.delete(roomMembersKey(roomId));
        redis.opsForValue().increment("room:v:"+roomId);
    }
}