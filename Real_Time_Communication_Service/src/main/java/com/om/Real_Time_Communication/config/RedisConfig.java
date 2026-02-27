package com.om.Real_Time_Communication.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * Redis templates for read models:
 *  - StringRedisTemplate: fast ops for strings, hashes, sets (room last msg, unread counts)
 *  - RedisTemplate<String, byte[]>: optional binary cache (attachments metadata, small blobs)
 *
 * Connection settings are provided by Spring Boot auto-configuration from properties/env.
 */
@Configuration
public class RedisConfig {

    /** Primary template used by the read-model updater (strings, sets, hashes). */
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory cf) {
        return new StringRedisTemplate(cf);
    }

    /** Optional: generic template for binary values (if you decide to store small byte[] blobs). */
    @Bean
    public RedisTemplate<String, byte[]> binaryRedisTemplate(RedisConnectionFactory cf) {
        RedisTemplate<String, byte[]> tpl = new RedisTemplate<>();
        tpl.setConnectionFactory(cf);

        // Keys & hash keys as plain strings
        tpl.setKeySerializer(new StringRedisSerializer());
        tpl.setHashKeySerializer(new StringRedisSerializer());

        // Values & hash values as raw bytes
        RedisSerializer<byte[]> byteSer = RedisSerializer.byteArray(); // ✅ public method
        tpl.setValueSerializer(byteSer);
        tpl.setHashValueSerializer(byteSer);

        tpl.afterPropertiesSet();
        return tpl;
    }

    /** Optional JSON template if you want to store typed objects as JSON in Redis. */
    @Bean
    public RedisTemplate<String, Object> jsonRedisTemplate(RedisConnectionFactory cf) {
        RedisTemplate<String, Object> tpl = new RedisTemplate<>();
        tpl.setConnectionFactory(cf);

        tpl.setKeySerializer(new StringRedisSerializer());
        tpl.setHashKeySerializer(new StringRedisSerializer());

        // Use Jackson JSON for values
        Jackson2JsonRedisSerializer<Object> jsonSer = new Jackson2JsonRedisSerializer<>(Object.class);
        tpl.setValueSerializer(jsonSer);
        tpl.setHashValueSerializer(jsonSer);

        tpl.afterPropertiesSet();
        return tpl;
    }

}