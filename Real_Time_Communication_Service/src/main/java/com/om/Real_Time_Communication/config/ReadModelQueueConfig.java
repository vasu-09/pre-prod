package com.om.Real_Time_Communication.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ReadModelQueueConfig {

    @Bean
    public Queue readmodelQueue() {
        return QueueBuilder.durable("rtc.readmodel.message.created").build();
    }

    @Bean
    public Binding readmodelBinding(Queue readmodelQueue, TopicExchange rtcEventsExchange) {
        return BindingBuilder.bind(readmodelQueue)
                .to(rtcEventsExchange)
                .with("room.*.message.created");
    }
}
