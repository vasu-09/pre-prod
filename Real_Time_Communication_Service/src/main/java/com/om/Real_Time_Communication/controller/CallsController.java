package com.om.Real_Time_Communication.controller;
// CallsController.java
import com.om.Real_Time_Communication.Repository.CallSessionRepository;
import com.om.Real_Time_Communication.dto.CallDtoMapper;
import com.om.Real_Time_Communication.dto.CallSessionDto;
import com.om.Real_Time_Communication.service.CallSessionService;
import com.om.Real_Time_Communication.service.TurnService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calls")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed-origins}")
public class CallsController {

    private  TurnService turn;

    private  CallSessionRepository repo;
    private CallDtoMapper mapper;

    private CallSessionService callSessionService;


    @GetMapping("/turn")
    public Map<String,Object> turn(Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        return turn.creds(userId);
    }
    @GetMapping("/history")
    public List<CallSessionDto> history(Principal principal,
                                        @RequestParam(required = false) Instant beforeTs,
                                        @RequestParam(required = false) Long beforeId,
                                        @RequestParam(defaultValue = "50") int limit) {
        Long userId = Long.valueOf(principal.getName());
        int lim = Math.min(Math.max(limit, 1), 200);
        return repo.pageHistory(userId, beforeTs, beforeId, PageRequest.of(0, lim))
                .stream().map(mapper::toDto).toList();
    }

    @PostMapping("/end/{callSessionId}")
    public ResponseEntity<?> endCall(@PathVariable Long callSessionId, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        callSessionService.endCall(callSessionId, userId, "server_request");
        return ResponseEntity.ok(Map.of("ok", true));
    }

}


