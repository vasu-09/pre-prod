package com.om.backend.Controllers;

import com.om.backend.services.OtpService;
import com.om.backend.services.UserSessionService;
import com.om.backend.util.JwtIntrospection;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class OtpController {

    private final OtpService otpService;
    private final UserSessionService userSessionService;

    public OtpController(OtpService otpService, UserSessionService userSessionService) {
        this.otpService = otpService;
        this.userSessionService = userSessionService;
    }

    // -------- DTOs --------

    public static class SendOtpRequest {
        public String phone;
    }

    public static class VerifyOtpRequest {
        public String phone;
        public String otp;
        public String deviceModel;     // e.g., "Pixel 7"
        public String platform;        // e.g., "android"
        public String appVersion;      // e.g., "1.3.0"
        public String fcmToken;        // optional: register device's FCM immediately
    }

    public static class RefreshRequest {
        public String refreshToken;
    }

    public static class TokenPair {
        public String accessToken;
        public String refreshToken;
        public String sessionId;
        public TokenPair() {}
        public TokenPair(String at, String rt, String sid) {
            this.accessToken = at; this.refreshToken = rt; this.sessionId = sid;
        }
    }

    public static class LoginResponse {
        public Long   userId;
        public String sessionId;
        public String accessToken;
        public String refreshToken;
        public Instant issuedAt = Instant.now();
        public LoginResponse() {}
        public LoginResponse(Long uid, String sid, String at, String rt) {
            this.userId = uid; this.sessionId = sid; this.accessToken = at; this.refreshToken = rt;
        }
    }

    // -------- Endpoints --------

    /**
     * Request an OTP to be sent to the given phone number.
     */
    @PostMapping("/otp/send")
    public ResponseEntity<Void> sendOtp(@RequestBody SendOtpRequest req) {
        if (req == null || req.phone == null || req.phone.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        otpService.sendOtp(req.phone); // implement to generate & deliver OTP (SMS)
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    /**
     * Verify OTP and log the user in:
     *  - create/update a session row
     *  - mint access/refresh tokens (with sid = sessionId)
     *  - bind the refresh token to the session (hash/jti/exp)
     *  - (optional) register device FCM token if provided
     */
    @PostMapping("/otp/verify")
    public ResponseEntity<LoginResponse> verifyOtp(@RequestBody VerifyOtpRequest req) {
        if (req == null || isBlank(req.phone) || isBlank(req.otp)) {
            return ResponseEntity.badRequest().build();
        }

        try {
            // 1) Validate OTP and resolve userId (create user if you support just-in-time)
            Long userId = otpService.verifyOtp(req.phone, req.otp); // returns userId or throws

            // 2) Create a sessionId and upsert the session row
            String sessionId = UUID.randomUUID().toString();
            String platform = isBlank(req.platform) ? "android" : req.platform;
            userSessionService.createOrUpdateSession(userId, sessionId, req.deviceModel, platform, req.appVersion);

            // 3) Mint tokens (IMPORTANT: include sid=sessionId in the JWTs)
            String accessJwt  = otpService.mintAccessToken(userId, sessionId);
            String refreshJwt = otpService.mintRefreshToken(userId, sessionId);

            // 4) Bind refresh token to the session (store hash/jti/exp)
            userSessionService.bindRefreshToken(userId, sessionId, refreshJwt);

            // 5) (Optional) Register/update FCM token for this device session
            if (!isBlank(req.fcmToken)) {
                userSessionService.registerOrUpdateDevice(userId, sessionId, req.fcmToken, req.deviceModel, req.appVersion, platform);
            }

            return ResponseEntity.ok(new LoginResponse(userId, sessionId, accessJwt, refreshJwt));
        } catch (IllegalArgumentException e) {
            // Thrown when OTP is invalid/expired/not requested. Return HTTP 400 instead of 500.
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }


    }

    /**
     * Rotate the refresh token and issue a new access token.
     * Expects a valid refresh token (with sid claim) that matches the session's stored hash.
     */
    @PostMapping("/refresh")
    public ResponseEntity<TokenPair> refresh(@RequestBody RefreshRequest body) {
        if (body == null || isBlank(body.refreshToken)) {
            return ResponseEntity.badRequest().build();
        }

        // Extract essentials from old refresh (no need to re-verify here; service validates by hash/jti/exp)
        Long   userId    = Long.valueOf(JwtIntrospection.extractSub(body.refreshToken).orElseThrow(() -> new IllegalArgumentException("sub missing")));
        String sessionId = JwtIntrospection.extractSid(body.refreshToken).orElseThrow(() -> new IllegalArgumentException("sid missing"));

        // Mint new pair and rotate stored refresh
        String newAccess  = otpService.mintAccessToken(userId, sessionId);
        String newRefresh = otpService.mintRefreshToken(userId, sessionId);
        userSessionService.rotateRefreshToken(userId, sessionId, body.refreshToken, newRefresh);

        return ResponseEntity.ok(new TokenPair(newAccess, newRefresh, sessionId));
    }

    // -------- helpers --------
    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
}
