package com.om.Real_Time_Communication.dto;

import lombok.*;

import java.util.List;

@Data
@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
public class CreateGroupRequest {
    private String groupName;
    private List<String> participantPhoneNumbers;

    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }

    public List<String> getParticipantPhoneNumbers() {
        return participantPhoneNumbers;
    }

    public void setParticipantPhoneNumbers(List<String> participantPhoneNumbers) {
        this.participantPhoneNumbers = participantPhoneNumbers;
    }
}
