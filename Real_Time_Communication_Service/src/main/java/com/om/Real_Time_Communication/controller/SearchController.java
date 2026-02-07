package com.om.Real_Time_Communication.controller;

// imports:
import com.om.Real_Time_Communication.dto.SearchMessageDoc;
import com.om.Real_Time_Communication.service.RoomMembershipService;
import com.om.Real_Time_Communication.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
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
        var roomIds = membership.roomsForUser(userId);
        return searchService.searchAll(userId, roomIds, q, limit);
    }

    @GetMapping("/rooms/{roomId}")
    public Object searchInRoom(Principal principal,
                               @PathVariable Long roomId,
                               @RequestParam String q,
                               @RequestParam(defaultValue = "50") int limit) {
        Long userId = Long.valueOf(principal.getName());
        if (!membership.isMember(userId, roomId)) throw new IllegalArgumentException("Forbidden");
        return searchService.searchInRoomMvp(roomId, q, limit);
    }
}
