package com.om.backend.Controllers;

import com.om.backend.Dto.*;
import com.om.backend.Model.NotificationPreferences;
import com.om.backend.Model.PrivacySettings;
import com.om.backend.Model.User;
import com.om.backend.services.AvatarService;
import com.om.backend.services.UserService;
import com.om.backend.services.UserSessionService;
import com.om.backend.util.JwtIntrospection;
import com.sun.security.auth.UserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/user")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserSessionService sessionService;

    @Autowired
    private AvatarService avatarSvc;

    // --- Notification prefs ---
    @GetMapping("/me/preferences/notifications")
    public ResponseEntity<NotificationPreferences> getNotificationPreferences(Principal p) {
        Long uid = Long.valueOf(p.getName());
        return ResponseEntity.ok(userService.getNotificationPreferences(uid));
    }
    @PutMapping("/me/preferences/notifications")
    public ResponseEntity<NotificationPreferences> putNotificationPreferences(Principal p, @RequestBody NotificationPreferences body) {
        Long uid = Long.valueOf(p.getName());
        return ResponseEntity.ok(userService.updateNotificationPreferences(uid, body));
    }

    // --- Privacy ---
    @GetMapping("/me/privacy")
    public ResponseEntity<PrivacySettings> getPrivacy(Principal p) {
        Long uid = Long.valueOf(p.getName());
        return ResponseEntity.ok(userService.getPrivacy(uid));
    }

    @PutMapping("/me/privacy")
    public ResponseEntity<PrivacySettings> putPrivacy(Principal p, @RequestBody PrivacySettings body) {
        Long uid = Long.valueOf(p.getName());
        return ResponseEntity.ok(userService.updatePrivacy(uid, body));
    }

    // --- Sessions ---
    @GetMapping("/me/sessions")
    public ResponseEntity<List<SessionDto>> listSessions(Principal p, HttpServletRequest req) {
        Long uid = Long.valueOf(p.getName());
        String bearer = req.getHeader(HttpHeaders.AUTHORIZATION);
        String currentSid = JwtIntrospection.extractSid(bearer).orElse(null);
        return ResponseEntity.ok(sessionService.listSessions(uid, currentSid));
    }

    @DeleteMapping("/me/sessions/{sessionId}")
    public ResponseEntity<Void> logoutDevice(Principal p, @PathVariable String sessionId) {
        Long uid = Long.valueOf(p.getName());
        sessionService.revokeSession(uid, sessionId);
        return ResponseEntity.noContent().build();
    }

    // --- Subscription ---

    @PostMapping("/me/sessions/logout")
    public ResponseEntity<Void> logoutCurrent(Principal p, HttpServletRequest req) {
        Long uid = Long.valueOf(p.getName());
        String bearer = req.getHeader("Authorization");
        sessionService.revokeCurrentSession(uid, bearer);
        return ResponseEntity.noContent().build();
    }

    // --- Device registration (FCM) ---
    @PostMapping("/me/devices")
    public ResponseEntity<Void> registerDevice(Principal p, @RequestBody RegisterDeviceDto dto) {
        Long uid = Long.valueOf(p.getName());
        // Ensure the session's FCM token is stored and last-seen timestamp updated
        sessionService.registerOrUpdateDevice(
                uid,
                dto.getSessionId(),
                dto.getFcmToken(),
                dto.getDeviceModel(),
                dto.getAppVersion(),
                dto.getPlatform());
        return ResponseEntity.noContent().build();
    }

    // --- Per-chat mute ---
    @PutMapping("/me/chats/{chatId}/mute")
    public ResponseEntity<Void> setChatMute(Principal p, @PathVariable Long chatId, @RequestBody MuteChatDto dto) {
        Long uid = Long.valueOf(p.getName());
        Instant until = (dto.mutedUntil == null || dto.mutedUntil.isBlank()) ? null : Instant.parse(dto.mutedUntil);
        userService.setChatMute(uid, chatId, until);
        return ResponseEntity.noContent().build();
    }
    @DeleteMapping("/me/chats/{chatId}/mute")
    public ResponseEntity<Void> clearChatMute(Principal p, @PathVariable Long chatId) {
        Long uid = Long.valueOf(p.getName());
        userService.clearChatMute(uid, chatId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/me/avatar/intent")
    public AvatarIntentResp intent(Principal principal,
                                   @RequestBody AvatarIntentReq req) {
        Long userId = Long.valueOf(principal.getName());
        return avatarSvc.createIntent(userId, req);
    }

    @PostMapping("/me/avatar/commit")
    public User commit(Principal principal,
                       @RequestBody AvatarCommitReq req) {
        Long userId = Long.valueOf(principal.getName());
        return avatarSvc.commit(userId, req);
    }

    @PostMapping("/get-ids-by-phone-numbers")
    public ResponseEntity<List<Long>> getListofIdsByPhoneNumbers(@RequestBody List<String> phoneNumbers){
        return userService.getUserIdsByPhoneNumbers(phoneNumbers);
    }

    @PostMapping("/get-id-by-phone-numbers")
    public ResponseEntity<Long> getUseridByPhoneNumber(@RequestBody String phoneNumber){
        return userService.getUserIdByPhoneNumber(phoneNumber);
    }

    @PostMapping("/get-phone-number-by-id")
    public ResponseEntity<String> getPhoneNumberByUserID(@RequestBody Long id){
        return  userService.getPhoneNumberByUserID(id);
    }

    @PostMapping("/get-phone-numbers-by-ids")
    public ResponseEntity<List<String>> getPhoneNumbersById(@RequestBody List<Long> id){
        return  userService.getPhoneNumbersByIds(id);
    }

    @PostMapping("/users/get-name-by-id")
    public String getUserById(@RequestBody Long id){
        return userService.getUserById(id);
    }

    @GetMapping("/{id}")
    public UserProfileDto findById(@PathVariable("id") String id){
        return userService.getUserProfileById(Long.valueOf(id));
    }
}


