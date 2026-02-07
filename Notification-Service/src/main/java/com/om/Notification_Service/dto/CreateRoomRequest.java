package com.om.Notification_Service.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.AnyKeyJavaClass;

import java.util.Set;

@Setter
@Getter
@AllArgsConstructor
public class CreateRoomRequest {
    private Set<Long> participantIds;
    private ChatRoomType type;
    private String name;           // optional, for group rooms
    private String description;    // optional

    // constructors, getters, setters (or use Lombok @Data/@Builder)

    public CreateRoomRequest() { }

    public CreateRoomRequest(Set<Long> participantIds, ChatRoomType type) {
        this.participantIds = participantIds;
        this.type = type;
    }

    // ... more constructors/getters/setters
}
