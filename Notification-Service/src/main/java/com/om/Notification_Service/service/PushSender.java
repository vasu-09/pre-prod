package com.om.Notification_Service.service;

import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.om.Notification_Service.dto.EventMessage;
import com.google.firebase.messaging.MulticastMessage;
import com.om.Notification_Service.models.UserDevice;
import com.om.Notification_Service.repository.UserDeviceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;


@Service
public class PushSender {

    @Autowired
    private UserDeviceRepository userDeviceRepository;

    private static final Logger logger = LoggerFactory.getLogger(PushSender.class);
    private static final int MAX_RETRIES = 5;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public void sendPush(EventMessage event, Long userId) {
        sendPush(event, userId, 0L);
    }




    public void sendPush(EventMessage event, Long userId, Long attempt) {
        List<String> fcmTokens = getFcmTokensForUser(event.getUserId());
        if (fcmTokens == null || fcmTokens.isEmpty()) {
            logger.warn("No FCM token found for user {}", userId);
            return;
        }

        Map<String, Object> data = event.getData();
        String title;
        String body;

        switch (event.getType()) {
            // 1. Meeting Lifecycle Notifications
            case "MEETING_SCHEDULED":
                title = "Meeting Scheduled: " + data.getOrDefault("title", "Untitled Meeting");
                body = "Starts at " + data.getOrDefault("startTime", "Unknown time") + ", hosted by " + data.getOrDefault("hostName", "Unknown");
                break;
            case "MEETING_UPDATED":
                title = "Meeting Updated: " + data.getOrDefault("title", "Untitled Meeting");
                body = "Meeting details have been changed.";
                break;
            case "MEETING_CANCELLED":
                title = "Meeting Cancelled: " + data.getOrDefault("title", "Untitled Meeting");
                body = "This meeting has been cancelled.";
                break;
            case "MEETING_STARTED":
                title = "Meeting Started: " + data.getOrDefault("title", "Untitled Meeting");
                body = "Your meeting has started.";
                break;
            case "MEETING_ENDED":
                title = "Meeting Ended: " + data.getOrDefault("title", "Untitled Meeting");
                body = "The meeting has ended.";
                break;
            case "MEETING_REMINDER":
                title = "Reminder: Meeting Starting Soon";
                body = "Your meeting \"" + data.getOrDefault("title", "Untitled Meeting") + "\" starts in 5 minutes.";
                break;
            case "MEETING_RESCHEDULED":
                title = "Meeting Rescheduled";
                body = "Meeting has been rescheduled to " + data.getOrDefault("newTime", "Unknown time");
                break;

            // 2. Waiting Room Notifications
            case "USER_REQUESTED_TO_JOIN_MEETING":
                title = "Waiting Room Approval Needed";
                body = data.getOrDefault("userName", "A user") + " wants to join your meeting.";
                break;
            case "USER_ADMITTED_TO_MEETING":
                title = "You’ve Been Admitted";
                body = "You have been admitted to the meeting.";
                break;
            case "USER_DENIED_FROM_MEETING":
                title = "Admission Denied";
                body = "You were denied entry to the meeting.";
                break;
            case "USER_JOINED_MEETING":
                title = "User Joined Meeting";
                body = data.getOrDefault("userName", "A user") + " has joined the meeting.";
                break;

            // 3. Meeting Started/End Notifications


            // 4. Message & Chat Notifications
            case "NEW_MESSAGE":
                title = "New Message from " + data.getOrDefault("senderName", "Someone");
                body = String.valueOf(data.getOrDefault("message", ""));
                break;
            case "GROUP_MESSAGE":
                title = "New message in #" + data.getOrDefault("groupName", "group");
                body = data.getOrDefault("senderName", "Someone") + ": " + data.getOrDefault("message", "");
                break;


            // 5. Call & Video Notifications
            case "INCOMING_CALL":
                title = "Incoming Call";
                body = data.getOrDefault("callerName", "Someone") + " is calling you.";
                break;
            case "MISSED_CALL":
                title = "Missed Call";
                body = "You missed a call from " + data.getOrDefault("callerName", "Someone") + ".";
                break;
            case "CALL_ENDED":
                title = "Call Ended";
                body = "Your call has ended.";
                break;


            // 6. Security & Moderation
            case "ACCOUNT_LOGGED_IN_ON_ANOTHER_DEVICE":
                title = "Security Alert";
                body = "Your account was accessed from a new device.";
                break;
            case "ACCOUNT_LOCKED_SUSPICIOUS_ACTIVITY":
                title = "Security Alert";
                body = "Suspicious activity detected on your account.";
                break;

            // 8. File Sharing
            case "FILE_RECEIVED":
                title = "File Received";
                body = "You received a file from " + data.getOrDefault("senderName", "someone") + ".";
                break;
            case "FILE_UPLOAD_FAILED":
                title = "Upload Failed";
                body = "Upload failed. Tap to retry.";
                break;

            // Default fallback
            default:
                title = "Notification";
                body = "You have a new event: " + event.getType();
        }

        for (String fcmToken : fcmTokens) {
            Notification notification = Notification.builder()
                    .setTitle(title)
                    .setBody(body)
                    .build();

            try {
                if (fcmTokens.size() == 1) {
                    Message message = Message.builder()
                            .setToken(fcmTokens.get(0))
                            .setNotification(notification)
                            .putData("eventType", event.getType())
                            .build();
                    String response = FirebaseMessaging.getInstance().send(message);
                    logger.info("Successfully sent push notification to user {} token {}: {}", userId, fcmToken, response);
                    System.out.println("Successfully sent push notification: " + response);
                } else {
                    MulticastMessage message = MulticastMessage.builder()
                            .addAllTokens(fcmTokens)
                            .setNotification(notification)
                            .putData("eventType", event.getType())
                            .build();
                    BatchResponse response = FirebaseMessaging.getInstance().sendMulticast(message);
                    logger.info("Successfully sent push notifications to " + response.getSuccessCount() + "devices");

                }
            } catch (FirebaseMessagingException e) {
                MessagingErrorCode code = e.getMessagingErrorCode();
                if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
                    logger.warn("Removing invalid FCM token for user {} token {} due to {}", event.getUserId(), fcmToken, code);
                    removeFcmTokenForUser(event.getUserId());
                } else if (code == MessagingErrorCode.UNAVAILABLE || code == MessagingErrorCode.INTERNAL) {
                    logger.warn("Transient error sending to user {} token {}: {}", event.getUserId(), fcmToken, code);
                    if (attempt < MAX_RETRIES) {
                        scheduleRetry(event, attempt + 1);
                    } else {
                        logger.error("Max retry attempts reached for user {} token {}", userId, fcmToken);
                    }
                } else {
                    logger.error("Failed to send FCM message to user {} token {}: {}", userId, fcmToken, code, e);
                }
            }
        }


    }

    private void scheduleRetry(EventMessage event, Long attempt) {
        long delay = (long) Math.pow(2, attempt);
        scheduler.schedule(() -> sendPush(event, attempt), delay, TimeUnit.SECONDS);
    }

    private void removeFcmTokenForUser(Long userId) {
        // Remove the token from persistent storage
    }
    private List<String> getFcmTokensForUser (Long userId){
        return userDeviceRepository.findByUserId(userId)
                .stream()
                .map(UserDevice::getFcmToken)
                .toList();
    }
}

