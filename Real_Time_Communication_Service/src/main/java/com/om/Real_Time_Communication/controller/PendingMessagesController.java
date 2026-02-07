package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.service.InboxDeliveryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class PendingMessagesController {

    private static final Logger log = LoggerFactory.getLogger(PendingMessagesController.class);
    private final InboxDeliveryService inboxDeliveryService;

    public PendingMessagesController(InboxDeliveryService inboxDeliveryService) {
        this.inboxDeliveryService = inboxDeliveryService;
    }

    @GetMapping("/pending")
    public ResponseEntity<List<Map<String, Object>>> pending(
            Principal principal,
            @RequestParam(value = "since", required = false) String since
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        Instant cutoff = null;
        if (since != null && !since.isBlank()) {
            try {
                cutoff = Instant.parse(since);
            } catch (DateTimeParseException ex) {
                log.warn("Invalid since parameter {}; ignoring", since);
            }
        }

        Long userId = Long.valueOf(principal.getName());
        List<Map<String, Object>> payloads = inboxDeliveryService.pendingMessages(userId, cutoff);
        return ResponseEntity.ok(payloads);
    }
}
