package com.om.Real_Time_Communication.config;

import com.om.Real_Time_Communication.Repository.ChatRoomParticipantRepository;
import com.om.Real_Time_Communication.Repository.ChatRoomRepository;
import com.om.Real_Time_Communication.models.ChatRoom;
import com.om.Real_Time_Communication.service.BlockService;
import com.om.Real_Time_Communication.utility.AclService;
import com.om.Real_Time_Communication.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;


import java.util.Optional;
import java.security.Principal;
import java.util.List;

/**
 * Validates JWT in STOMP CONNECT (if handshake didn’t set a Principal),
 * and authorizes SUBSCRIBE / SEND per destination.
 */
@Component
@RequiredArgsConstructor
public class StompSecurityInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompSecurityInterceptor.class);
    // If your API-Gateway signs an internal header instead of passing Authorization,
    // verify that here instead. For simplicity we reuse the same secret as the handshake.
    @Autowired
    private JwtService jwtService;

    @Autowired
    private  BlockService blockService;

    @Autowired
    private   AclService acl;

    @Autowired
    private  ChatRoomParticipantRepository participantRepo;

    @Autowired
    private ChatRoomRepository chatRoomRepository;


    @Override
    public void afterSendCompletion(Message<?> message, MessageChannel channel, boolean sent, Exception ex) {
        MDC.clear();
    }
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor acc = StompHeaderAccessor.wrap(message);
        StompCommand cmd = acc.getCommand();
        if (cmd == null) return message;

        // MDC/correlation as you already added…
        try {
            Long userId = extractUserId(acc);
            String destination = acc.getDestination();
            String sessionId = acc.getSessionId();
            
            try {
                switch (cmd) {
               case CONNECT: {
                    // If the WebSocket handshake did not attach a Principal (e.g. token missing from headers),
                    // fall back to validating the STOMP CONNECT headers.
                    if (userId == null) {
                        // 1) Prefer the authenticated userId attached during the WebSocket handshake
                        //    (JwtHandshakeInterceptor stores it in the session attributes). This covers
                        //    cases where intermediaries strip the CONNECT headers but the initial HTTP
                        //    handshake was already authenticated.
                        Object attrUserId = acc.getSessionAttributes().get("userId");
                        if (attrUserId instanceof Long uid) {
                            WsUserPrincipal principal = new WsUserPrincipal(uid);
                            acc.setUser(principal);
                            userId = uid;
                        }
                    }

                    if (userId == null) {
                        String token = headerFirst(acc, HttpHeaders.AUTHORIZATION);
                        if (token == null) {
                            token = headerFirst(acc, "authorization"); // tolerate lowercase from some clients
                        }
                        if (token == null) {
                            token = headerFirst(acc, "access_token");
                        }
                        if (token == null) {
                            token = headerFirst(acc, "token");
                        }
                        if (token == null) {
                            // Some STOMP clients send login/passcode instead of Authorization; honor that too.
                            token = headerFirst(acc, "login");
                        }

                        if (token != null && !token.isBlank()) {
                            JwtService.JwtIdentity id = jwtService.parse(normalizeToken(token));
                            WsUserPrincipal principal = new WsUserPrincipal(id.getUserId());
                            acc.setUser(principal);
                            acc.getSessionAttributes().put("userId", id.getUserId());
                            userId = id.getUserId();
                        }else {
                            log.warn("STOMP CONNECT missing Authorization/login token; rejecting session {}", acc.getSessionId());
                            throw new IllegalArgumentException("Missing auth token in CONNECT (Authorization: Bearer <jwt> or login header)");
                        }
                    }
                    break;
                }
                case SUBSCRIBE: {
                    requireUser(acc); // throws if null
                    String dest = acc.getDestination(); // /topic/room/{roomId}
                    if (dest != null && dest.startsWith("/topic/room/")) {
                        String roomKey = dest.substring("/topic/room/".length()).split("/")[0];
                        Long roomId = resolveRoomId(roomKey);

                        // 1) Room ACL (Redis-backed)
                        if (!acl.canSubscribe(userId, roomId)) {
                            throw new IllegalArgumentException("Forbidden: not a member of room " + roomId);
                        }

                        // 2) Block check (receiver-side): if any member blocks this user, deny subscribe for DM/1:1
                        // For group rooms, you might only enforce peer block on direct @mentions or DMs; adjust policy.
                        if (isDirectRoom(roomId)) {
                            Long other = directPeer(roomId, userId);
                            if (blockService.isBlocked(String.valueOf(userId), String.valueOf(other))) {
                                throw new IllegalArgumentException("Forbidden: you are blocked");
                            }
                        }
                    }
                    break;
                }
                case SEND: {
                    requireUser(acc);
                    String dest = acc.getDestination();

                    // Clients send to application destinations (/app/rooms/{roomKey}/send).
                    // Accept both the legacy broker prefix (/topic/room/{roomKey}) and the
                    // newer application prefix so ACL checks still run and errors are surfaced
                    // instead of silently dropping the frame.
                    String roomKey = null;
                    roomKey = extractRoomKey(dest);

                    if (roomKey != null) {
                        Long roomId = resolveRoomId(roomKey);

                        // 1) Room ACL
                        if (!acl.canPublish(userId, roomId)) {
                            throw new IllegalArgumentException("Forbidden: cannot publish to room " + roomId);
                        }

                        // 2) Block check (sender-side): for DMs, or for group if you enforce peer blocks globally
                        if (isDirectRoom(roomId)) {
                            Long other = directPeer(roomId, userId);
                            if (blockService.isBlocked(String.valueOf(userId), String.valueOf(other))) {
                                throw new IllegalArgumentException("Forbidden: user has blocked you");
                            }
                        }
                    }
                    break;
                }
                default: /* no-op */
                }
            } catch (Exception e) {
                log.error("STOMP security preSend failed: cmd={} session={} user={} dest={} err={}",
                        cmd, sessionId, userId, destination, e.getMessage(), e);
                throw e;
            }
            return message;
        } finally {
            // MDC clear in afterSendCompletion()
        }
    }

    private boolean isDirectRoom(Long roomId) {
        return participantRepo.countByRoomId(roomId) == 2L;
    }

    /** Resolve a room key to the numeric primary key used internally. */
    private Long resolveRoomId(String roomKey) {
        // Prefer the public "roomId" stable identifier
        Optional<Long> byExternalId = chatRoomRepository.findByRoomId(roomKey).map(ChatRoom::getId);
        if (byExternalId.isPresent()) {
            return byExternalId.get();
        }

        // Fallback: allow clients that still reference the numeric id directly
        try {
            Long numericId = Long.valueOf(roomKey);
            return chatRoomRepository.findById(numericId)
                    .map(ChatRoom::getId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown room " + roomKey));
        } catch (NumberFormatException ignore) {
            throw new IllegalArgumentException("Unknown room " + roomKey);
        }
    }
    
    /** Return the other user in a 1:1 room (throws if not exactly two). */
    private Long directPeer(Long roomId, Long userId) {
        java.util.List<Long> users = participantRepo.findUserIdsByRoomId(roomId);
        if (users.size() != 2) throw new IllegalArgumentException("Not a direct room: " + roomId);
        return users.get(0).equals(userId) ? users.get(1) : users.get(0);
    }
    private static String headerFirst(StompHeaderAccessor acc, String name) {
        List<String> v = acc.getNativeHeader(name);
        return (v == null || v.isEmpty()) ? null : v.get(0);
    }

    private static Long requireUser(StompHeaderAccessor acc) {
        Long id = extractUserId(acc);
        if (id != null) {
            return id;
        }

        Principal p = acc.getUser();
        String desc = p != null ? p.getName() : "<none>";
        throw new IllegalArgumentException("No valid Principal on frame (found: " + desc + ")");
    }

    private static Long extractUserId(StompHeaderAccessor acc) {
        Principal p = acc.getUser();
        if (p == null) {
            return null;
        }
        if (p instanceof WsUserPrincipal custom) {
            return custom.getUserId();
        }
        try {
            return Long.valueOf(p.getName());
        } catch (NumberFormatException nfe) {
            // Non-numeric principals (e.g., usernames set by API Gateway) should not abort CONNECT;
            // fall back to token-based auth instead.
            log.debug("Ignoring non-numeric Principal on session {}: {}", acc.getSessionId(), p.getName());
            return null;
        }
    }

    private static String normalizeToken(String token) {
        if (token == null) {
            return null;
        }
        String trimmed = token.trim();
        if (trimmed.length() >= 6 && trimmed.regionMatches(true, 0, "bearer", 0, 6)) {
            int idx = 6;
            while (idx < trimmed.length() && Character.isWhitespace(trimmed.charAt(idx))) idx++;
            if (idx < trimmed.length() && trimmed.charAt(idx) == ':') {
                idx++;
                while (idx < trimmed.length() && Character.isWhitespace(trimmed.charAt(idx))) idx++;
            }
            return trimmed.substring(idx).trim();
        }
        return trimmed;
    }

    private static String extractRoomKey(String dest) {
        if (dest == null) {
            return null;
        }

        if (dest.startsWith("/app/rooms/")) {
            return dest.substring("/app/rooms/".length()).split("/")[0];
        }

        if (dest.startsWith("/app/rooms.")) {
            String remainder = dest.substring("/app/rooms.".length());
            int end = findSeparator(remainder);
            return end > 0 ? remainder.substring(0, end) : remainder;
        }

        if (dest.startsWith("/topic/room/")) {
            return dest.substring("/topic/room/".length()).split("/")[0];
        }

        return null;
    }

    private static int findSeparator(String value) {
        int slash = value.indexOf('/') < 0 ? Integer.MAX_VALUE : value.indexOf('/');
        int dot = value.indexOf('.') < 0 ? Integer.MAX_VALUE : value.indexOf('.');
        int min = Math.min(slash, dot);
        return min == Integer.MAX_VALUE ? -1 : min;
    }

    /**
     * Minimal Principal that carries userId as name for STOMP APIs.
     */
    static final class WsUserPrincipal implements Principal {
        private final Long userId;
        WsUserPrincipal(Long userId) { this.userId = userId; }
        @Override public String getName() { return String.valueOf(userId); }
        public Long getUserId() { return userId; }
    }

    /**
     * Replace this with your real ACL service (DB/Redis).
     */
    static final class Acl {
        static boolean canSubscribe(Long userId, String roomId) { return true; }
        static boolean canPublish(Long userId, String roomId) { return true; }
    }
}