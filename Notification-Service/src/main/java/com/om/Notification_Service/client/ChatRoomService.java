package com.om.Notification_Service.client;

import com.om.Notification_Service.dto.ChatRoomDto;
import com.om.Notification_Service.dto.ChatRoomType;
import com.om.Notification_Service.dto.CreateRoomRequest;
import feign.FeignException;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Set;

@FeignClient(name = "real-time-communication",contextId = "chatRoomClient", path = "/api/chat/rooms", url = "${real-time-communication.url:http://localhost:20}")
public interface ChatRoomService {

    @GetMapping("/direct")
    ChatRoomDto getDirectRoom(@RequestParam("userA") Long userA,
                              @RequestParam("userB") Long userB);

    @PostMapping
    ChatRoomDto createRoom(@RequestBody CreateRoomRequest req);

    default ChatRoomDto getOrCreateDirectRoom(Long userA, Long userB) {
        try {
            return getDirectRoom(userA, userB);
        } catch (FeignException.NotFound ex) {
            CreateRoomRequest req = new CreateRoomRequest(
                    Set.of(userA, userB),
                    ChatRoomType.DIRECT
            );
            return createRoom(req);
        }
    }
}
