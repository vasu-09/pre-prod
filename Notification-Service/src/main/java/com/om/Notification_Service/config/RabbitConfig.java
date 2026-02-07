package com.om.Notification_Service.config;

import org.springframework.amqp.core.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;

@Configuration
public class RabbitConfig {
    public static final String EXCHANGE = "app.events";
    // Exchange that real-time communication (RTC) service publishes to
    public static final String RTC_EXCHANGE = "rtc.notifications";
    // Exchange used by the To-Do service
    public static final String TODO_EXCHANGE = "todo.events";
    public static final String QUEUE = "notification.queue";
    public static final String ROUTING_KEY = "notification.#";

    // 1. Create a Topic Exchange
    @Bean
    Exchange appEventsExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE).durable(true).build();
    }

    // Exchanges from other services
    @Bean
    Exchange rtcNotificationsExchange() {
        return ExchangeBuilder.topicExchange(RTC_EXCHANGE).durable(true).build();
    }

    @Bean
    Exchange todoEventsExchange() {
        return ExchangeBuilder.topicExchange(TODO_EXCHANGE).durable(true).build();
    }

    // 2. Create a Queue

    @Bean
    Queue notificationQueue() {
        return QueueBuilder.durable(QUEUE)
                .withArgument("x-dead-letter-exchange", EXCHANGE + ".dlx")
                .withArgument("x-dead-letter-routing-key", "notification.dlq")
                .withArgument("x-message-ttl", 30000)          // 30s retry delay
                .withArgument("x-max-length", 100000)          // back-pressure
                .build();
    }

    // 3. Bind the Queue to the Exchange with a routing key
    @Bean
    Binding bindNotificationQueue(Queue notificationQueue, Exchange appEventsExchange) {
        return BindingBuilder
                .bind(notificationQueue)
                .to(appEventsExchange)
                .with(ROUTING_KEY)
                .noargs();
    }

    // Bindings for RTC events
    @Bean
    Binding bindRtcMessageNew(Queue notificationQueue, Exchange rtcNotificationsExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(rtcNotificationsExchange)
                .with("notif.message.new")
                .noargs();
    }

    @Bean
    Binding bindRtcMessageOffline(Queue notificationQueue, Exchange rtcNotificationsExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(rtcNotificationsExchange)
                .with("notif.message.offline")
                .noargs();
    }

    @Bean
    Binding bindRtcCallEvents(Queue notificationQueue, Exchange rtcNotificationsExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(rtcNotificationsExchange)
                .with("notif.call.#")
                .noargs();
    }

    @Bean
    Binding bindRtcGroupEvents(Queue notificationQueue, Exchange rtcNotificationsExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(rtcNotificationsExchange)
                .with("notif.group.#")
                .noargs();
    }

    // Bindings for To-Do service events
    @Bean
    Binding bindTodoEvents(Queue notificationQueue, Exchange todoEventsExchange) {
        return BindingBuilder.bind(notificationQueue)
                .to(todoEventsExchange)
                .with("todo.#")
                .noargs();
    }

    // RabbitConfig.java


    @Bean
    Exchange deadLetterExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE + ".dlx").durable(true).build();
    }

    @Bean
    Queue notificationDLQ() {
        return QueueBuilder.durable("notification.queue.dlq").build();
    }

    @Bean
    Binding bindDLQ(Queue notificationDLQ, Exchange deadLetterExchange) {
        return BindingBuilder.bind(notificationDLQ).to(deadLetterExchange)
                .with("notification.dlq").noargs();
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

}

