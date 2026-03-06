package com.om.Notification_Service.client;

import com.om.Notification_Service.dto.UserProfileDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "authentication-service", path = "/user", url = "${AUTH_SERVICE_BASE_URL:http://auth-service.moc-preprod.svc.cluster.local:80}")
public interface UserService {

    @GetMapping("/{id}")
    UserProfileDto findById(@PathVariable("id") String id);
}
