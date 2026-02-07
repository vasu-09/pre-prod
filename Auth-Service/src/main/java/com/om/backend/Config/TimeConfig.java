package com.om.backend.Config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class TimeConfig {
    @Bean
    public Clock clock(@Value("${app.clock.zone}") String zone) {
        return Clock.system(ZoneId.of(zone));  // throws if zone is invalid
    }
}
