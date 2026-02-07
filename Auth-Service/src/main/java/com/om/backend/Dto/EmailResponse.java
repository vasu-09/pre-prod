package com.om.backend.Dto;

public class EmailResponse {
    private String email;

    public EmailResponse() {
    }

    public EmailResponse(String email) {
        this.email = email;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}
