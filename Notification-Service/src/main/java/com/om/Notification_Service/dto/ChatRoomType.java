package com.om.Notification_Service.dto;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

public enum ChatRoomType {
    DIRECT,    // 1:1 conversation
    GROUP,     // multi-user conversation
    BROADCAST  // e.g., announcements
}