package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.service.BlockService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

// BlockController.java
@RestController
@RequestMapping("/api/blocks")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class BlockController {
    private final BlockService blockService;

    public BlockController(BlockService blockService) { this.blockService = blockService; }

    @PostMapping("/{blockedId}")
    public ResponseEntity<?> blockUser(@PathVariable String blockedId, Principal principal) {
        blockService.blockUser(principal.getName(), blockedId);
        return ResponseEntity.ok("User blocked");
    }

    @DeleteMapping("/{blockedId}")
    public ResponseEntity<?> unblockUser(@PathVariable String blockedId, Principal principal) {
        blockService.unblockUser(principal.getName(), blockedId);
        return ResponseEntity.ok("User unblocked");
    }
}
