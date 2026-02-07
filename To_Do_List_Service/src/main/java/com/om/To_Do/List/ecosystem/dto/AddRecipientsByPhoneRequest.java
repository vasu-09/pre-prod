package com.om.To_Do.List.ecosystem.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Setter
@Getter

public class AddRecipientsByPhoneRequest  {
    private List<String> phoneNumbers;


    public AddRecipientsByPhoneRequest() {
    }

    public AddRecipientsByPhoneRequest(List<String> phoneNumbers) {
        this.phoneNumbers = phoneNumbers;
    }

    public List<String> getPhoneNumbers() {
        return phoneNumbers;
    }

    public void setPhoneNumbers(List<String> phoneNumbers) {
        this.phoneNumbers = phoneNumbers;
    }
}
