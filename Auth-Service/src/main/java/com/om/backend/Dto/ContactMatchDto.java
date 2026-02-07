package com.om.backend.Dto;

import lombok.AllArgsConstructor;
import lombok.Data;


public class ContactMatchDto { private Long userId; private String phone;

    public ContactMatchDto(Long userId, String phone) {
        this.userId = userId;
        this.phone = phone;
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
}
