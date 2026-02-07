package com.om.Real_Time_Communication.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    // Exchange used by OutboxPublisher (or Debezium bridge)
    public static final String EXCHANGE_EVENTS = "rtc.events";

    // Read-model queue (consumer updates Redis)
    public static final String Q_READMODEL_MSG_CREATED = "rtc.readmodel.message.created";

    // Optional DLQ & retry queue (recommended)
    public static final String Q_READMODEL_MSG_CREATED_DLQ   = "rtc.readmodel.message.created.dlq";
    public static final String Q_READMODEL_MSG_CREATED_RETRY = "rtc.readmodel.message.created.retry";

    // Routing keys
    public static final String RK_MESSAGE_CREATED_PATTERN = "room.*.message.created";

    @Bean
    public TopicExchange rtcEventsExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE_EVENTS)
                .durable(true)
                .build();
    }

    /** Basic queue (no DLQ). If you want DLQ/Retry, comment this out and use the block below instead. */
    @Bean
    public Queue readModelQueue() {
        return QueueBuilder.durable(Q_READMODEL_MSG_CREATED).build();
    }

    @Bean
    public Binding readModelBinding(Queue readModelQueue, TopicExchange rtcEventsExchange) {
        return BindingBuilder.bind(readModelQueue)
                .to(rtcEventsExchange)
                .with(RK_MESSAGE_CREATED_PATTERN);
    }

    /* -------------------- Optional: DLQ + retry wiring --------------------
    // Enable this section if you want dead-letter handling and time-based retry.
    @Bean
    public Queue readModelDlq() {
        return QueueBuilder.durable(Q_READMODEL_MSG_CREATED_DLQ).build();
    }

    @Bean
    public Queue readModelRetry() {
        // Messages dead-letter back to the main queue after TTL expires
        return QueueBuilder.durable(Q_READMODEL_MSG_CREATED_RETRY)
                .withArgument("x-message-ttl", 15000) // 15s backoff
                .withArgument("x-dead-letter-exchange", EXCHANGE_EVENTS)
                .withArgument("x-dead-letter-routing-key", RK_MESSAGE_CREATED_PATTERN)
                .build();
    }

    @Bean
    public Binding readModelDlqBinding(TopicExchange rtcEventsExchange, Queue readModelDlq) {
        // Bind DLQ so you can manually publish to it if needed
        return BindingBuilder.bind(readModelDlq)
                .to(rtcEventsExchange)
                .with(Q_READMODEL_MSG_CREATED_DLQ);
    }
    ----------------------------------------------------------------------- */

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate tpl = new RabbitTemplate(connectionFactory);
        // Ensure unroutable messages are returned (helps detect mis-binds)
        tpl.setMandatory(true);
        return tpl;
    }
}


