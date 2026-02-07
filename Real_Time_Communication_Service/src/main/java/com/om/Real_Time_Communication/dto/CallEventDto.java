package com.om.Real_Time_Communication.dto;

import org.springframework.messaging.core.MessagePostProcessor;

public class CallEventDto {

    private String type; // JOIN, LEAVE
    private String userId;
    public CallEventDto(String join, String userId) {
    }
}
