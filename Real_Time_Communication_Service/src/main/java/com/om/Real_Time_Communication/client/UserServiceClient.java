package com.om.Real_Time_Communication.client;


import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Calendar;
import java.util.List;

@FeignClient(name = "authentication-service",  url = "${authentication-service.url:http://localhost:0}")
public interface UserServiceClient {

    @PostMapping("/users/get-ids-by-phone-numbers")
    public ResponseEntity<List<Long>> getUserIdsByPhoneNumbers(@RequestBody List<String> phoneNumbers);


    @PostMapping("/users/get-name-by-id")
    String getUserById(Long removerId);
}
