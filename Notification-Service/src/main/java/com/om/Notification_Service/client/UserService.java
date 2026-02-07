package com.om.Notification_Service.client;

import com.om.Notification_Service.dto.UserProfileDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "authentication-service", path = "/user", url = "${authentication-service.url:http://localhost:0}")
public interface UserService {

    @GetMapping("/{id}")
    UserProfileDto findById(@PathVariable("id") String id);
}
