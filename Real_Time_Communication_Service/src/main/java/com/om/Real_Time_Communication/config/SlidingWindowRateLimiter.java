package com.om.Real_Time_Communication.config;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicInteger;

/** Simple sliding-window limiter for single-node. Replace with Redis for cluster. */
@Component
public class SlidingWindowRateLimiter {
    private static final class Window {
        final long windowMs;
        volatile long start;
        final AtomicInteger count = new AtomicInteger(0);
        Window(long now, long windowMs) { this.start = now; this.windowMs = windowMs; }
    }

    private final ConcurrentMap<String, Window> buckets = new ConcurrentHashMap<>();

    /** Allow <= limit events per windowMs; else throw. */
    public void checkOrThrow(String key, int limit, long windowMs) {
        long now = System.currentTimeMillis();
        Window w = buckets.compute(key, (k, cur) -> (cur == null || now - cur.start >= windowMs)
                ? new Window(now, windowMs) : cur);
        if (now - w.start >= w.windowMs) {
            w.start = now;
            w.count.set(0);
        }
        int n = w.count.incrementAndGet();
        if (n > limit) throw new IllegalArgumentException("Rate limit exceeded: " + key);
    }
}
