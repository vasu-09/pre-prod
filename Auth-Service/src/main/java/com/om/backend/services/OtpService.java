
/**
 * Handles OTP send/verify and mints JWTs by delegating to a JwtSigner bean.
 * Make sure your JwtSigner sets the 'sid' claim to the sessionId you pass in.
 */
package com.om.backend.services;

import com.om.backend.Config.SmsProperties;
import com.om.backend.Dto.SendSmsResponse;
import com.om.backend.Model.User;
import com.om.backend.Model.Otp;

import com.om.backend.Repositories.OtpRepository;
import com.om.backend.Repositories.UserRepository;
import com.om.backend.util.OtpMessageBuilder;
import com.om.backend.util.PhoneNumberUtil1;          // your util with toE164India(...)


import com.om.backend.util.SmsClient;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


import java.util.Optional;
import java.util.concurrent.TimeUnit;


/**
 * OTP service backed by Redis for OTP storage & rate limiting, and your SMS provider for delivery.
 * Persists users in DB; (optional) can persist OTP rows for audit.
 */
@Service
public class OtpService {

    // ===== Injected deps (from your old class) =====
    private final StringRedisTemplate redis;
    private final SmsProperties props;
    private final SmsClient smsClient;
    private final OtpMessageBuilder messageBuilder;

    // ===== Existing deps from the "new" design =====
    private final OtpRepository otpRepo;      // optional (audit); keep if you want
    private final UserRepository userRepo;
    private final JwtSigner jwtSigner;
    private final Clock clock;

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    public OtpService(StringRedisTemplate redis, SmsProperties props, SmsClient smsClient, OtpMessageBuilder messageBuilder, OtpRepository otpRepo, UserRepository userRepo, JwtSigner jwtSigner, Clock clock) {
        this.redis = redis;
        this.props = props;
        this.smsClient = smsClient;
        this.messageBuilder = messageBuilder;
        this.otpRepo = otpRepo;
        this.userRepo = userRepo;
        this.jwtSigner = jwtSigner;
        this.clock = clock;
    }

// ===================== SEND OTP =====================

    /**
     * Step 1: generate & send OTP via SMS (Redis + rate limits).
     */
    @Transactional(noRollbackFor = RuntimeException.class)
    public void sendOtp(String rawPhone) {
        String e164 = PhoneNumberUtil1.toE164India(rawPhone);
        String providerMobile = "NSN10".equalsIgnoreCase(props.getNumberFormat())
                ? PhoneNumberUtil1.toIndiaNsn10(rawPhone)
                : PhoneNumberUtil1.toIndia91NoPlus(rawPhone);
        // 1) rate-limit (Redis counters)
        enforceRateLimits(e164);

        // 2) generate OTP using your config
        int digits = props.getOtp().getDigits();
        String otp = generateNumericOtp(digits);

        // 3) store OTP in Redis with TTL (overwrite any existing)
        Duration ttl = Duration.ofMinutes(props.getOtp().getTtlMinutes());
        redis.opsForValue().set(otpKey(e164), otp, ttl);

        // 4) optionally persist to the relational store for audit purposes only
        if (isAuditEnabled()) {
            Optional.ofNullable(otpRepo)
                    .ifPresent(repo -> {
                        Otp row = repo.findByPhoneNumber(e164).orElseGet(Otp::new);
                        row.setPhoneNumber(e164);
                        row.setOtpCode(otp);
                        row.setCreatedAt(Instant.now(clock));
                        row.setExpiredAt(Instant.now(clock).plus(ttl));
                        repo.save(row);
                    });
        }

        // Send via your SMS provider
        SendSmsResponse res = smsClient.sendOtpMessage(messageBuilder.build(otp), providerMobile, true);
        log.info("OTP send: e164={}, providerMobile={}", e164, providerMobile);
        if (res == null || !res.isOk()) {
            String desc = res != null && res.getErrorDescription() != null ? res.getErrorDescription() : "unknown";
            Integer code = res != null ? res.getErrorCode() : null;
            throw new RuntimeException("SMS send failed: " + desc + (code != null ? " (code " + code + ")" : ""));
        }

    }


    // ===================== VERIFY OTP =====================

    /**
     * Step 2: verify OTP from Redis; delete on success; return userId (create user if needed).
     * This replaces the previous DB-only verification.
     */
    @Transactional
    public Long verifyOtp(String rawPhone, String otpCode) {
       if (otpCode == null || otpCode.isBlank()) {
            throw new IllegalArgumentException("OTP code is required");
        }

        String e164 = PhoneNumberUtil1.toE164India(rawPhone);
        // 1) fetch OTP from Redis
        String key = otpKey(e164);
        String expected = redis.opsForValue().get(key);
        if (expected != null) {
            // Redis path (preferred)
            if (!otpCode.equals(expected)) {
                throw new IllegalArgumentException("Invalid OTP");
            }
            // delete OTP (single-use)
            redis.delete(key);
        } else {
            // Optional DB fallback when auditing is enabled
               if (!isAuditEnabled() || otpRepo == null) {
                throw new IllegalArgumentException("OTP expired or not requested");
            }
            Optional<Otp> audit = otpRepo.findByPhoneNumber(e164);
            if (audit.isEmpty() || Instant.now(clock).isAfter(audit.get().getExpiredAt())) {
                throw new IllegalArgumentException("OTP expired or not requested");
            }
            if (!otpCode.equals(audit.get().getOtpCode())) {
                throw new IllegalArgumentException("Invalid OTP");
            }
            // clear audit row if you want true single-use semantics
            otpRepo.delete(audit.get());
        }

        // 2) resolve/create user
        return userRepo.findByPhoneNumber(e164)
                .map(User::getId)
                .orElseGet(() -> {
                    User u = new User();
                    u.setPhoneNumber(e164);
                    u.setCreatedAt(Instant.now(clock));
                    u.setUpdatedAt(Instant.now(clock));
                    userRepo.save(u);
                    return u.getId();
                });
    }

    // ===================== TOKEN MINTING =====================

    /**
     * Mint a short-lived access token (must include 'sid' = sessionId).
     */
    public String mintAccessToken(Long userId, String sessionId) {
        return jwtSigner.signAccessToken(userId, sessionId);
    }

    /**
     * Mint a long-lived refresh token (recommended to include 'sid' = sessionId).
     */
    public String mintRefreshToken(Long userId, String sessionId) {
        return jwtSigner.signRefreshToken(userId, sessionId);
    }

    // ===================== HELPERS =====================

    private String otpKey(String phone) {
        // dedicated namespace in Redis
        return "otp:" + phone;
    }

    private String rlMinuteKey(String phone) {
        return "otp:rl:minute:" + phone;
    }

    private String rlHourlyKey(String phone) {
        return "otp:rl:hour:" + phone;
    }

    /**
     * Basic dual-window rate limiting:
     * - per-minute: e.g., 1–3 sends
     * - per-day:    e.g., 5–10 sends
     * These thresholds come from SmsProperties.
     */
    private void enforceRateLimits(String phone) {
        int perMinute = props.getOtp().getPerMinuteLimit();
        int perHour = props.getOtp().getPerHourLimit();
        Instant now = Instant.now(clock);

        // minute window (60s)
        Long minuteCount = redis.opsForValue().increment(rlMinuteKey(phone));
        if (minuteCount != null && minuteCount == 1L) {
            redis.expire(rlMinuteKey(phone), 60, TimeUnit.SECONDS);
        }
        if (minuteCount != null && minuteCount > perMinute) {
            throw new IllegalStateException("Too many OTP requests. Try again later.");
        }

        // daily window (24h)
        Long hourCount = redis.opsForValue().increment(rlHourlyKey(phone));
        if (hourCount != null && hourCount > perHour) {
            throw new IllegalStateException("Too many OTP requests. Try again later.");
        }
    }

    private String generateNumericOtp(int digits) {
        if (digits <= 0) {
            throw new IllegalArgumentException("OTP length must be positive");
        }
        StringBuilder builder = new StringBuilder(digits);
        for (int i = 0; i < digits; i++) {
            builder.append(RANDOM.nextInt(10));
        }
        return builder.toString();
    }
     private boolean isAuditEnabled() {
        return props.getOtp().isPersistForAudit();
    }

        /** Minimal signer abstraction expected to be provided elsewhere in your app. */


    public interface JwtSigner {
        String signAccessToken(Long userId, String sessionId);

        String signRefreshToken(Long userId, String sessionId);
    }
}

