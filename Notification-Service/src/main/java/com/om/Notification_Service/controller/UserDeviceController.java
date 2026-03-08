package com.om.Notification_Service.controller;

import com.om.Notification_Service.dto.RegisterUserDeviceRequest;
import com.om.Notification_Service.service.UserDeviceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/internal/user-devices")
public class UserDeviceController {

    private final UserDeviceService userDeviceService;

    public UserDeviceController(UserDeviceService userDeviceService) {
        this.userDeviceService = userDeviceService;
    }

    @PostMapping
    public ResponseEntity<Void> upsert(@RequestBody RegisterUserDeviceRequest req) {
        userDeviceService.upsert(req);
        return ResponseEntity.noContent().build();
    }
}