package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.dto.MessageDto;
import com.om.Real_Time_Communication.service.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

// MessagesRestController.java
@RestController
@RequestMapping("/api/messages")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class MessagesRestController {
    private final MessageService messageService;

    public MessagesRestController(MessageService messageService) { this.messageService = messageService; }
    @GetMapping("/{chatRoomId}/history")
    public ResponseEntity<List<MessageDto>> getGroupMessageHistory(
            @PathVariable String chatRoomId,
            Principal principal) {

        String currentUserId = principal.getName();
        List<MessageDto> messages = messageService.getGroupMessageHistory(chatRoomId, currentUserId);
        return ResponseEntity.ok(messages);
    }
}

