package com.om.backend.Dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class SendSmsRequest {
    @JsonProperty("ApiKey")
    private String ApiKey;
    @JsonProperty("ClientId")
    private String ClientId;
    @JsonProperty("SenderId")
    private String SenderId;
    @JsonProperty("Message")
    private String Message;
    @JsonProperty("MobileNumbers")
    private String MobileNumbers;

    public SendSmsRequest() {
    }

    public SendSmsRequest(String apiKey, String clientId, String senderId, String message, String mobileNumbers) {
        ApiKey = apiKey;
        ClientId = clientId;
        SenderId = senderId;
        Message = message;
        MobileNumbers = mobileNumbers;
    }

    public String getApiKey() {
        return ApiKey;
    }

    public void setApiKey(String apiKey) {
        ApiKey = apiKey;
    }

    public String getClientId() {
        return ClientId;
    }

    public void setClientId(String clientId) {
        ClientId = clientId;
    }

    public String getSenderId() {
        return SenderId;
    }

    public void setSenderId(String senderId) {
        SenderId = senderId;
    }

    public String getMessage() {
        return Message;
    }

    public void setMessage(String message) {
        Message = message;
    }

    public String getMobileNumbers() {
        return MobileNumbers;
    }

    public void setMobileNumbers(String mobileNumbers) {
        MobileNumbers = mobileNumbers;
    }
}
