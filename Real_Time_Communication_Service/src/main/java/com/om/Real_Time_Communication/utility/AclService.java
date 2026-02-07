package com.om.Real_Time_Communication.utility;

import com.om.Real_Time_Communication.Repository.ChatRoomParticipantRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class AclService {
    private final StringRedisTemplate redis;


    public AclService(StringRedisTemplate redis) {
        this.redis = redis;
    }


    public boolean canSubscribe(Long userId, Long roomId) {
        Boolean ok = redis.opsForSet().isMember("room:members:"+roomId, String.valueOf(userId));
        return Boolean.TRUE.equals(ok);

    }

    public boolean canPublish(Long userId, Long roomId) {
        // same as subscribe or stricter if you have roles (owners/mods)
        return canSubscribe(userId, roomId);
    }
    // bump version on membership change
    public void onMembershipChanged(Long roomId) {

    redis.opsForValue().increment("room:v:"+roomId);
    }
}
