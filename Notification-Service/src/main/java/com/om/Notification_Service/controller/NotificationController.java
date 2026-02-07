package com.om.Notification_Service.controller;

import com.om.Notification_Service.models.Notification;
import com.om.Notification_Service.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class NotificationController {

    @Autowired
    private NotificationService service;



    @GetMapping
    public List<Notification> list(
            @RequestParam Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return service.listNotifications(userId, pageable).getContent();
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markRead(@PathVariable Long id) {
        service.markAsRead(id);
        return ResponseEntity.noContent().build();
    }
}

