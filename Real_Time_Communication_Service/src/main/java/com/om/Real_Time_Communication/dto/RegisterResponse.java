package com.om.Real_Time_Communication.dto;

public class RegisterResponse {
    private final boolean signatureValid;
    private final String errorCode;

    public RegisterResponse(boolean signatureValid, String errorCode) {
        this.signatureValid = signatureValid;
        this.errorCode = errorCode;
    }

    public boolean isSignatureValid() {
        return signatureValid;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
