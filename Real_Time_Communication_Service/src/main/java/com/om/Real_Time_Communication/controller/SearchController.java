package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.dto.SearchMessageDoc;
import com.om.Real_Time_Communication.service.RoomMembershipService;
import com.om.Real_Time_Communication.service.SearchService;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.security.Principal;

@RestController
@RequestMapping("/api/search")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class SearchController {
    private final SearchService searchService;
    private final RoomMembershipService membership;

    public SearchController(SearchService searchService, RoomMembershipService membership) {
        this.searchService = searchService;
        this.membership = membership;
    }

    @GetMapping
    public java.util.List<SearchMessageDoc> searchAll(Principal principal,
                                                      @RequestParam String q,
                                                      @RequestParam(defaultValue = "50") int limit) {
        Long userId = Long.valueOf(principal.getName());
        String deviceId = resolveDeviceId(principal);
        var roomIds = membership.roomsForUser(userId, deviceId);
        return searchService.searchAll(userId, roomIds, q, limit);
    }

    @GetMapping("/rooms/{roomId}")
    public Object searchInRoom(Principal principal,
                               @PathVariable Long roomId,
                               @RequestParam String q,
                               @RequestParam(defaultValue = "50") int limit) {
        Long userId = Long.valueOf(principal.getName());
        String deviceId = resolveDeviceId(principal);

        if (!membership.isVisibleToDevice(userId, deviceId, roomId)) {
            throw new IllegalArgumentException("Forbidden");
        }

        var cutoff = membership.historyVisibleFrom(userId, deviceId);
        return searchService.searchInRoomMvpVisible(roomId, q, limit, cutoff);
    }

    private String resolveDeviceId(Principal principal) {
        if (principal instanceof JwtAuthenticationToken jwtAuth) {
            Object claimDeviceId = jwtAuth.getToken().getClaim("deviceId");
            if (claimDeviceId instanceof String asString && !asString.isBlank()) {
                return asString;
            }
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Authenticated device id is missing");
    }
}
