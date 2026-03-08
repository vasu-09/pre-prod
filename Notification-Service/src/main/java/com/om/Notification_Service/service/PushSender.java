package com.om.Notification_Service.service;

import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.om.Notification_Service.dto.EventMessage;
import com.om.Notification_Service.models.UserDevice;
import com.om.Notification_Service.repository.UserDeviceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import org.springframework.beans.factory.annotation.Autowired;
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
        List<String> fcmTokens = getFcmTokensForUser(userId);
        if (fcmTokens.isEmpty()) {
            logger.warn("No FCM token found for user {}", userId);
            return;
        }

        Map<String, Object> data = event.getData() == null ? Map.of() : event.getData();
        String title;
        String body;

        switch (event.getType()) {
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
            case "NEW_MESSAGE":
                title = "New Message from " + data.getOrDefault("senderName", "Someone");
                body = String.valueOf(data.getOrDefault("message", ""));
                break;
            case "GROUP_MESSAGE":
                title = "New message in #" + data.getOrDefault("groupName", "group");
                body = data.getOrDefault("senderName", "Someone") + ": " + data.getOrDefault("message", "");
                break;
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
            case "ACCOUNT_LOGGED_IN_ON_ANOTHER_DEVICE":
                title = "Security Alert";
                body = "Your account was accessed from a new device.";
                break;
            case "ACCOUNT_LOCKED_SUSPICIOUS_ACTIVITY":
                title = "Security Alert";
                body = "Suspicious activity detected on your account.";
                break;
            case "FILE_RECEIVED":
                title = "File Received";
                body = "You received a file from " + data.getOrDefault("senderName", "someone") + ".";
                break;
            case "FILE_UPLOAD_FAILED":
                title = "Upload Failed";
                body = "Upload failed. Tap to retry.";
                break;
            default:
                title = "Notification";
                body = "You have a new event: " + event.getType();
        }

        Notification notification = Notification.builder()
                .setTitle(title)
                .setBody(body)
                .build();

        try {
            if (fcmTokens.size() == 1) {
                String fcmToken = fcmTokens.get(0);
                Message message = Message.builder()
                        .setToken(fcmToken)
                        .setNotification(notification)
                        .putData("eventType", event.getType())
                        .build();
                String response = FirebaseMessaging.getInstance().send(message);
                logger.info("Successfully sent push notification to user {} token {}: {}", userId, fcmToken, response);
            } else {
                MulticastMessage message = MulticastMessage.builder()
                        .addAllTokens(fcmTokens)
                        .setNotification(notification)
                        .putData("eventType", event.getType())
                        .build();
                BatchResponse response = FirebaseMessaging.getInstance().sendMulticast(message);
                logger.info("Successfully sent push notifications to {} devices for user {}", response.getSuccessCount(), userId);
                for (int i = 0; i < response.getResponses().size(); i++) {
                    if (!response.getResponses().get(i).isSuccessful()) {
                        handleMessagingException(userId, fcmTokens.get(i), response.getResponses().get(i).getException(), event, attempt);
                    }
                }
            }
            } catch (FirebaseMessagingException e) {
            String maybeToken = fcmTokens.size() == 1 ? fcmTokens.get(0) : "<multicast>";
            handleMessagingException(userId, maybeToken, e, event, attempt);
        }
    }

    private void handleMessagingException(Long userId,
                                          String fcmToken,
                                          FirebaseMessagingException e,
                                          EventMessage event,
                                          Long attempt) {
        MessagingErrorCode code = e.getMessagingErrorCode();
        if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
            logger.warn("Removing invalid FCM token for user {} token {} due to {}", userId, fcmToken, code);
            removeFcmTokenForUser(userId, fcmToken);
        } else if (code == MessagingErrorCode.UNAVAILABLE || code == MessagingErrorCode.INTERNAL) {
            logger.warn("Transient error sending to user {} token {}: {}", userId, fcmToken, code);
            if (attempt < MAX_RETRIES) {
                scheduleRetry(event, userId, attempt + 1);
            } else {
                logger.error("Max retry attempts reached for user {} token {}", userId, fcmToken);
            }
        } else {
            logger.error("Failed to send FCM message to user {} token {}: {}", userId, fcmToken, code, e);
        }
    }

    private void scheduleRetry(EventMessage event, Long userId, Long attempt) {
        long delay = (long) Math.pow(2, attempt);
        scheduler.schedule(() -> sendPush(event, userId, attempt), delay, TimeUnit.SECONDS);
    }

    private void removeFcmTokenForUser(Long userId, String fcmToken) {
        if (fcmToken == null || fcmToken.isBlank()) {
            return;
        }
        userDeviceRepository.deleteByUserIdAndFcmToken(userId, fcmToken);
    }
    
    private List<String> getFcmTokensForUser(Long userId) {
        List<String> rawTokens = userDeviceRepository.findByUserId(userId)
                .stream()
                .map(UserDevice::getFcmToken)
                .filter(token -> token != null && !token.isBlank())
                .toList();

        List<String> fcmTokens = rawTokens.stream()
                .filter(token -> !token.startsWith("ExponentPushToken["))
                .toList();

        if (rawTokens.size() != fcmTokens.size()) {
            logger.warn("Skipping {} Expo push token(s) for user {} because PushSender expects native FCM tokens", rawTokens.size() - fcmTokens.size(), userId);
        }

        return fcmTokens;
    }
}

