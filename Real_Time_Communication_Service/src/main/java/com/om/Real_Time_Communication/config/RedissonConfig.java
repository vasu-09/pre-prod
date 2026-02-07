package com.om.Real_Time_Communication.config;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(name = "rtc.redis.enabled", havingValue = "true")
public class RedissonConfig {

    @Value("${rtc.redis.url:redis://localhost:6379}")
    private String redisUrl;

    @Bean(destroyMethod = "shutdown")
    public RedissonClient redissonClient() {
        Config config = new Config();
        config.useSingleServer().setAddress(redisUrl);
        return Redisson.create(config);
    }
}