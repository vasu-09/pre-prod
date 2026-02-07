package com.om.Real_Time_Communication.utility;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Bucket4j;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;

@Component
public class WebSocketRateLimiter {

    @Autowired(required = false)
    private RedissonClient redissonClient;

    private final ConcurrentMap<String, Bucket> localBuckets = new ConcurrentHashMap<>();

    private static final Bandwidth ipLimit = Bandwidth.simple(100, Duration.ofMinutes(1));   // 50 connections per IP
    private static final Bandwidth userLimit = Bandwidth.simple(32, Duration.ofMinutes(1)); // 10 per user

    public boolean isAllowed(String ip, String userId) {
        Bucket ipBucket = getBucket("ip:" + ip, ipLimit);
        Bucket userBucket = getBucket("user:" + userId, userLimit);

        return ipBucket.tryConsume(1) && userBucket.tryConsume(1);
    }

    private Bucket getBucket(String key, Bandwidth limit) {
        if (redissonClient != null) {
            RBucket<Bucket> redisBucket = redissonClient.getBucket(key);
            Bucket bucket = redisBucket.get();
            if (bucket == null) {
                bucket = Bucket4j.builder().addLimit(limit).build();
                redisBucket.set(bucket, 1, TimeUnit.HOURS);
            }
            return bucket;
        }
        return localBuckets.computeIfAbsent(key, k -> Bucket4j.builder().addLimit(limit).build());
    }
}
