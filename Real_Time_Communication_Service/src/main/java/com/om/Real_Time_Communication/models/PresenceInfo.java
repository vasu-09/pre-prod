package com.om.Real_Time_Communication.models;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class PresenceInfo {
    private String userId;
    private boolean online;
    private String sessionId;
    private LocalDateTime lastSeen;
}
