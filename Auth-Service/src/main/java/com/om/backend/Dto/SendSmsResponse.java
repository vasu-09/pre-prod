package com.om.backend.Dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;

@Data
public class SendSmsResponse {
    @JsonProperty("ErrorCode")
    private Integer errorCode;
    @JsonProperty("ErrorDescription")
    private String errorDescription;
    @JsonProperty("Data")
    private JsonNode data;

    public SendSmsResponse() {
    }

    public SendSmsResponse(Integer errorCode, String errorDescription, JsonNode data) {
        this.errorCode = errorCode;
        this.errorDescription = errorDescription;
        this.data = data;
    }

    public Integer getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(Integer errorCode) {
        this.errorCode = errorCode;
    }

    public String getErrorDescription() {
        return errorDescription;
    }

    public void setErrorDescription(String errorDescription) {
        this.errorDescription = errorDescription;
    }

    public JsonNode getData() {
        return data;
    }

    public void setData(JsonNode data) {
        this.data = data;
    }

    public boolean isOk() {
        return errorCode == null || errorCode == 0;
    }
}
