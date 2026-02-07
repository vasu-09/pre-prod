package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.ChatRoomParticipantRepository;
import com.om.Real_Time_Communication.Repository.ChatRoomRepository;
import io.micrometer.common.lang.Nullable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class RoomMembershipService {



    private final ChatRoomParticipantRepository repo;

    @Autowired
    private  @Nullable StringRedisTemplate redis;
    private  Duration ttl;

    private String kUserRooms(Long userId) { return "user:rooms:" + userId; }
    private String kRoomMembers(Long roomId) { return "room:members:" + roomId; }


    public RoomMembershipService(ChatRoomParticipantRepository repo) {
        this.repo = repo;
    }

    public List<Long> memberIds(Long roomId) {
        // Example: query participants table
        return repo.findUserIdsByRoomId(roomId);
    }

    public boolean isMember(Long userId, Long roomId) {
        return repo.existsByRoomIdAndUserId(roomId, userId);
    }

    public List<Long> roomsForUser(Long userId) {
        // Try Redis first
        if (redis != null) {
            Set<String> s = redis.opsForSet().members(kUserRooms(userId));
            if (s != null && !s.isEmpty()) {
                // touch TTL
                redis.expire(kUserRooms(userId), ttl);
                List<Long> out = new ArrayList<>(s.size());
                for (String v : s) out.add(Long.valueOf(v));
                return out;
            }
        }
        // Fallback to DB
        List<Long> list = repo.findChatRoomIdsByUserId(userId);
        // Warm cache
        if (redis != null && !list.isEmpty()) {
            String key = kUserRooms(userId);
            String[] vals = list.stream().map(String::valueOf).toArray(String[]::new);
            redis.opsForSet().add(key, vals);
            redis.expire(key, ttl);
        }
        return list;
    }

    public void evictUserRooms(Long userId) {
        if (redis != null) {
            redis.delete(kUserRooms(userId));
        }
    }
}

