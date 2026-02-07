package com.om.Notification_Service.client;

import com.om.Notification_Service.dto.ChatMessageDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "real-time-communication",  contextId = "chatMessageClient", path = "/api/chat/messages", url = "${real-time-communication.url:http://localhost:20}")
public interface ChatMessageService {

    @PostMapping
    ChatMessageDto save(@RequestBody ChatMessageDto msg);

    @PostMapping("/broadcast")
    void broadcast(@RequestBody ChatMessageDto msg);
}
