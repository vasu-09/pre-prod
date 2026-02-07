package com.om.To_Do.List.ecosystem.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

@FeignClient(name = "authentication-service", url = "${authentication-service.url:http://localhost:0}")
public interface UserServiceClient {

    @PostMapping("/user/get-ids-by-phone-numbers")
    public ResponseEntity<List<Long>> getUserIdsByPhoneNumbers(@RequestBody List<String> phoneNumbers);

    @PostMapping("/user/get-id-by-phone-numbers")
    public ResponseEntity<Long> getUseridByPhoneNumber(@RequestBody String phoneNumber);


}
