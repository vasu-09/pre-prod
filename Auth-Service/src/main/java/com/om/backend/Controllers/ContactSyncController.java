package com.om.backend.Controllers;

import com.om.backend.Dto.ContactMatchDto;
import com.om.backend.Dto.ContactSyncRequest;
import com.om.backend.services.ContactSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/contacts")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed-origins}")
public class ContactSyncController {

    @Autowired
    private  ContactSyncService contactSyncService;


    @PostMapping("/sync")
    public ResponseEntity<List<ContactMatchDto>> sync(Principal principal,
                                                      @RequestBody ContactSyncRequest req) {
        Long userId = Long.valueOf(principal.getName()); // you added this helper earlier
        return ResponseEntity.ok(contactSyncService.match(req.getPhones()));
    }
}
