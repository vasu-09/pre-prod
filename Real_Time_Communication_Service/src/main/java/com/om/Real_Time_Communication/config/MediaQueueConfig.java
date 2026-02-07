package com.om.Real_Time_Communication.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Queue configuration for background media processing.
 * Binds the processing queue to the rtc.media exchange so that
 * MediaWorker can consume jobs published by MediaJobs.
 */
@Configuration
public class MediaQueueConfig {
    public static final String EXCHANGE = "rtc.media";
    public static final String QUEUE_PROCESS = "q.media.process";
    public static final String ROUTING_KEY_PROCESS = "media.process";

    @Bean
    public TopicExchange mediaExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE).durable(true).build();
    }

    @Bean
    public Queue mediaProcessQueue() {
        return QueueBuilder.durable(QUEUE_PROCESS).build();
    }

    @Bean
    public Binding mediaProcessBinding(Queue mediaProcessQueue, TopicExchange mediaExchange) {
        return BindingBuilder.bind(mediaProcessQueue)
                .to(mediaExchange)
                .with(ROUTING_KEY_PROCESS);
    }
}
