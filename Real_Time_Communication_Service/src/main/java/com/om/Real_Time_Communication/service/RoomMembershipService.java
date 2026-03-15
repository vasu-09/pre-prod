package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.ChatRoomParticipantRepository;
import io.micrometer.common.lang.Nullable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class RoomMembershipService {

    private final ChatRoomParticipantRepository repo;
    private final E2eeDeviceService deviceService;

    @Autowired
    private @Nullable StringRedisTemplate redis;

    private Duration ttl = Duration.ofMinutes(10);

    private String kUserRooms(Long userId, String deviceId) { return "user:rooms:" + userId + ":" + deviceId; }

    public RoomMembershipService(ChatRoomParticipantRepository repo, E2eeDeviceService deviceService) {
        this.repo = repo;
        this.deviceService = deviceService;
    }

    public List<Long> memberIds(Long roomId) {
        return repo.findUserIdsByRoomId(roomId);
    }

    public boolean isMember(Long userId, Long roomId) {
        return repo.existsByRoomIdAndUserId(roomId, userId);
    }

    public List<Long> roomsForUser(Long userId, String deviceId) {
        var activeDevice = deviceService.requireActiveDevice(userId, deviceId);

        if (redis != null) {
            Set<String> cached = redis.opsForSet().members(kUserRooms(userId, deviceId));
            if (cached != null && !cached.isEmpty()) {
                redis.expire(kUserRooms(userId, deviceId), ttl);
                List<Long> out = new ArrayList<>(cached.size());
                for (String v : cached) out.add(Long.valueOf(v));
                return out;
            }
        }
        
        List<Long> list = repo.findVisibleChatRoomIdsByUserId(userId, activeDevice.getHistoryVisibleFrom());
        if (redis != null && !list.isEmpty()) {
            String key = kUserRooms(userId, deviceId);
            String[] vals = list.stream().map(String::valueOf).toArray(String[]::new);
            redis.opsForSet().add(key, vals);
            redis.expire(key, ttl);
        }
        return list;
    }

    public void evictUserRooms(Long userId, String deviceId) {
        if (redis != null) {
            redis.delete(kUserRooms(userId, deviceId));
        }
    }

    public void evictUserRooms(Long userId) {
        if (redis != null) {
            Set<String> keys = redis.keys("user:rooms:" + userId + ":*");
            if (keys != null && !keys.isEmpty()) {
                redis.delete(keys);
            }
        }
    }
}

