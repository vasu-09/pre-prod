package com.om.Notification_Service.service;

import com.om.Notification_Service.config.RabbitConfig;
import com.om.Notification_Service.dto.EventMessage;
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
import java.util.HashMap;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RabbitListener(queues = RabbitConfig.QUEUE, ackMode = "MANUAL")
public class NotificationListener {

    private final NotificationService notificationService;
    
    private static final Logger log = LoggerFactory.getLogger(NotificationListener.class);

    public NotificationListener(NotificationService ns) {
        this.notificationService = ns;
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
    public void onEvent(Map<String, Object> payload,
                        Channel channel,
                        @Header(AmqpHeaders.DELIVERY_TAG) long tag) {
        try {
            log.info("Received raw payload: {}", payload);
            EventMessage event = toEventMessage(payload);

            if (isValid(event)) {
                notificationService.handleEvent(event);
                channel.basicAck(tag, false);
            } else {
                log.warn("Discarding invalid event: {}", event);
                channel.basicAck(tag, false);
            }
        } catch (Exception e) {
            log.error("Failed to process payload {}", payload, e);
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

    private EventMessage toEventMessage(Map<String, Object> payload) {
        EventMessage event = new EventMessage();

        Object type = payload.get("type");
        if (type != null) {
            event.setType(String.valueOf(type));
        }

        Object userId = payload.get("userId");
        if (userId instanceof Number number) {
            event.setUserId(number.longValue());
        }

        Object recipientIds = payload.get("recipientIds");
        if (recipientIds instanceof List<?> list) {
            event.setRecipientIds(list.stream()
                    .filter(value -> value != null)
                    .map(this::toLong)
                    .collect(Collectors.toList()));
        }

        Object version = payload.get("version");
        if (version instanceof Number number) {
            event.setVersion(number.intValue());
        }

        Map<String, Object> data = new HashMap<>(payload);
        data.remove("type");
        data.remove("userId");
        data.remove("recipientIds");
        data.remove("version");

        event.setData(data);
        return event;
    }

    private Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }

        return Long.parseLong(String.valueOf(value));
    }
}

