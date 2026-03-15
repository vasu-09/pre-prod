package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.dto.MessageDto;
import com.om.Real_Time_Communication.service.MessageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

// DmMessagesController.java
@RestController
@RequestMapping("/api/dm")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class DmMessagesController {
    private final MessageService messageService;

    public DmMessagesController(MessageService messageService) { this.messageService = messageService; }

    @GetMapping("/private/{otherUserId}")
    public ResponseEntity<List<MessageDto>> getConversationWithUser(@PathVariable String otherUserId,
                                                                    Principal principal) {
        throw new ResponseStatusException(
                HttpStatus.GONE,
                "Legacy plaintext direct-message history endpoint is disabled; use E2EE room history endpoints"
        );
    }
    
    @DeleteMapping("/private/{otherUserId}")
    public ResponseEntity<Void> deleteConversation(@PathVariable String otherUserId, Principal principal) {
        String currentUserId = principal.getName();
        messageService.deleteConversationForUser(currentUserId, otherUserId);
        return ResponseEntity.noContent().build();
    }
}

