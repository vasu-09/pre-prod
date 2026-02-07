package com.om.Notification_Service.service;

import com.om.Notification_Service.config.RabbitConfig;
import com.om.Notification_Service.dto.EventMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.om.Notification_Service.dto.ListDeletedEvent;
import com.om.Notification_Service.dto.ListNameChangedEvent;
import com.om.Notification_Service.dto.RecipientsAddedToListEvent;
import com.rabbitmq.client.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.annotation.RabbitHandler;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

@Service
@RabbitListener(queues = RabbitConfig.QUEUE, ackMode = "MANUAL")
public class NotificationListener {

    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    private static final Logger log = LoggerFactory.getLogger(NotificationListener.class);

    public NotificationListener(NotificationService ns, ObjectMapper mapper) {
        this.notificationService = ns;
        this.objectMapper = mapper;
    }

    @RabbitHandler
    public void onListDeleted(ListDeletedEvent event,
                              Channel channel,
                              @Header(AmqpHeaders.DELIVERY_TAG) long tag) {
        try {
            log.info("Received list deleted event: {}", event);
            notificationService.handleListDeleted(event);
            channel.basicAck(tag, false);
        } catch (Exception e) {
            log.error("Failed to process list deleted event {}", event, e);
            try {
                channel.basicNack(tag, false, false);
            } catch (Exception nackEx) {
                log.error("Failed to NACK message", nackEx);
            }
        }
    }

    @RabbitHandler
    public void onListNameChanged(ListNameChangedEvent event,
                                  Channel channel,
                                  @Header(AmqpHeaders.DELIVERY_TAG) long tag) {
        try {
            log.info("Received list name changed event: {}", event);
            notificationService.handleListNameChanged(event);
            channel.basicAck(tag, false);
        } catch (Exception e) {
            log.error("Failed to process list name changed event {}", event, e);
            try {
                channel.basicNack(tag, false, false);
            } catch (Exception nackEx) {
                log.error("Failed to NACK message", nackEx);
            }
        }
    }

    @RabbitHandler(isDefault = true)
    public void onEvent(String message,
                        Channel channel,
                        @Header(AmqpHeaders.DELIVERY_TAG) long tag) {
        try {
            log.info("Received raw message: {}", message);
            EventMessage event = objectMapper.readValue(message, EventMessage.class);
            if (isValid(event)) {
                notificationService.handleEvent(event);
                channel.basicAck(tag, false);
            } else {
                log.warn("Discarding invalid event: {}", event);
                channel.basicAck(tag, false);
            }
        } catch (Exception e) {
            log.error("Failed to process message {}", message, e);
            try {
                channel.basicNack(tag, false, false); // route to DLQ
            } catch (Exception nackEx) {
                log.error("Failed to NACK message", nackEx);
            }
        }
    }

    @RabbitHandler
    public void onRecipientsAdded(RecipientsAddedToListEvent event,
                                  Channel channel,
                                  @Header(AmqpHeaders.DELIVERY_TAG) long tag) {
        try {
            log.info("Received recipients added event: {}", event);
            notificationService.handleRecipientsAdded(event);
            channel.basicAck(tag, false);
        } catch (Exception e) {
            log.error("Failed to process recipients added event {}", event, e);
            try {
                channel.basicNack(tag, false, false);
            } catch (Exception nackEx) {
                log.error("Failed to NACK message", nackEx);
            }
        }
    }

    private boolean isValid(EventMessage e) {
        boolean hasRecipients = e.getRecipientIds() != null && !e.getRecipientIds().isEmpty();
        if (!hasRecipients && e.getUserId() == null) return false;
        if (e.getType() == null) return false;
        // Add per-type validation, e.g., MEETING_REMINDER needs startTime, roomId, etc.
        return true;
    }
}

