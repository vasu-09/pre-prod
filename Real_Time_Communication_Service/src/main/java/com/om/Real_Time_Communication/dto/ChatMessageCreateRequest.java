package com.om.Real_Time_Communication.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ChatMessageCreateRequest {
    private Long meetingId;        // Meeting chat room ID (usually meetingId as string)
    private String seriesId;      // "system" or some special user ID
    private String message;       // The system message content, e.g. "Meeting ended at... Duration..."
    private LocalDateTime timestamp;
}

