package com.om.backend.Dto;

import lombok.Data;

import java.util.List;

@Data
public class ContactSyncRequest { private List<String> phones;

    public List<String> getPhones() {
        return phones;
    }

    public void setPhones(List<String> phones) {
        this.phones = phones;
    }
}
