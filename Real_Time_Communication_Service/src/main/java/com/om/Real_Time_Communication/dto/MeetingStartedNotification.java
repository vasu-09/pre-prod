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
public class MeetingStartedNotification {

    private Long meetingId;
    private String message; // e.g. "Meeting started at 2025-05-27T10:00:00"
    private String seriesId;
    private LocalDateTime startTime;
}
