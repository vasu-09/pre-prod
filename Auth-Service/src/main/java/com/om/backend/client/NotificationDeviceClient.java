package com.om.backend.client;

import com.om.backend.Dto.RegisterUserDeviceRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "notification-service", url = "${notification.base-url:http://notification-service.moc-preprod.svc.cluster.local:80}")
public interface NotificationDeviceClient {

    @PostMapping("/api/internal/user-devices")
    void upsertDevice(@RequestBody RegisterUserDeviceRequest request);
}