package com.om.Real_Time_Communication.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.*;

import java.time.Duration;

/**
 * Redis templates for read models:
 *  - StringRedisTemplate: fast ops for strings, hashes, sets (room last msg, unread counts)
 *  - RedisTemplate<String, byte[]>: optional binary cache (attachments metadata, small blobs)
 *
 * Host/port/password typically come from application.yml via Spring Boot auto-config.
 * If you already rely on auto-config, you can omit the connection factory bean and keep only the templates.
 */
@Configuration
public class RedisConfig {

    // If you already rely on Spring Boot properties-based auto-config for Redis,
    // you can remove this bean and let Boot create the connection factory.
    @Bean
    public RedisConnectionFactory redisConnectionFactory() {
        // Prefer configuration from application.yml; fallback shown here
        RedisStandaloneConfiguration standalone = new RedisStandaloneConfiguration();
         standalone.setHostName("localhost");
         standalone.setPort(6379);
         standalone.setPassword(RedisPassword.of("yourPassword")); // if needed

        LettuceClientConfiguration clientCfg = LettuceClientConfiguration.builder()
                .commandTimeout(Duration.ofSeconds(3))
                .shutdownTimeout(Duration.ofMillis(100))
                .build();

        return new LettuceConnectionFactory(standalone, clientCfg);
    }

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

