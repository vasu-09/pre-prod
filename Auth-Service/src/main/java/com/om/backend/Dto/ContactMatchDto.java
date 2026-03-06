package com.om.backend.Dto;

import lombok.AllArgsConstructor;
import lombok.Data;


public class ContactMatchDto { 
    private Long userId; 
    private String phone; 
    private String avatarUrl;

    public ContactMatchDto(Long userId, String phone, String avatarUrl) {
        this.userId = userId;
        this.phone = phone;
        this.avatarUrl = avatarUrl;
    }

    public ContactMatchDto() {
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }
    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }
}
