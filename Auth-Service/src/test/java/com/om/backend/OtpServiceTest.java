package com.om.backend;

import com.om.backend.Config.SmsProperties;
import com.om.backend.Dto.SendSmsResponse;
import com.om.backend.Model.User;
import com.om.backend.Model.Otp;
import com.om.backend.Repositories.OtpRepository;
import com.om.backend.Repositories.UserRepository;
import com.om.backend.services.OtpService;
import com.om.backend.services.OtpService.JwtSigner;
import com.om.backend.util.OtpMessageBuilder;
import com.om.backend.util.SmsClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.mockito.Mockito;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import java.util.concurrent.atomic.AtomicLong;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class OtpServiceTest {



    private StringRedisTemplate redis;
    private ValueOperations<String, String> valueOps;
    private SmsProperties props;
    private OtpRepository otpRepo;
    private UserRepository userRepo;
    private Clock clock;
    private OtpService service;

    Map<String, String> store;
    Map<String, Long> expires;
    Map<String, Long> counters;
    Map<Long, User> usersById;
    Map<String, User> usersByPhone;
    AtomicLong userIdSeq;


    @BeforeEach
    void setup() {
        store = new HashMap<>();
        expires = new HashMap<>();
        counters = new HashMap<>();
        usersById = new HashMap<>();
        usersByPhone = new HashMap<>();
        userIdSeq = new AtomicLong(1);
        clock = Clock.fixed(Instant.parse("2023-01-01T00:00:00Z"), ZoneOffset.UTC);

        // mock redis
        StringRedisTemplate redis = Mockito.mock(StringRedisTemplate.class);
        ValueOperations<String,String> valueOps = Mockito.mock(ValueOperations.class);
        Mockito.when(redis.opsForValue()).thenReturn(valueOps);
        this.redis = redis;
        this.valueOps = valueOps;

        Mockito.doAnswer(inv -> {
            String key = inv.getArgument(0);
            String val = inv.getArgument(1);
            Duration ttl = inv.getArgument(2);
            store.put(key,val);
            expires.put(key, clock.instant().plus(ttl).getEpochSecond());
            return null;
        }).when(valueOps).set(anyString(), anyString(), any(Duration.class));

        Mockito.when(valueOps.get(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            Long exp = expires.get(key);
            if (exp != null && clock.instant().getEpochSecond() > exp) {
                store.remove(key); return null;
            }
            return store.get(key);
        });

        Mockito.when(valueOps.increment(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            Long val = counters.getOrDefault(key,0L)+1;
            counters.put(key,val);
            return val;
        });

        Mockito.when(redis.delete(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            store.remove(key); expires.remove(key); counters.remove(key);
            return true;
        });

        Mockito.when(redis.expire(anyString(), anyLong(), any(TimeUnit.class))).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            long timeout = inv.getArgument(1);
            TimeUnit unit = inv.getArgument(2);
            expires.put(key, clock.instant().plusSeconds(unit.toSeconds(timeout)).getEpochSecond());
            return true;
        });

        SmsProperties props = new SmsProperties();
        props.getOtp().setDigits(6);
        props.getOtp().setTtlMinutes(5);
        props.getOtp().setPerMinuteLimit(5);
        props.getOtp().setPerHourLimit(5);
        props.getDlt().setContent("OTP {#var#}");
        this.props = props;

        otpRepo = Mockito.mock(OtpRepository.class);

        userRepo = Mockito.mock(UserRepository.class);
        Mockito.when(userRepo.findByPhoneNumber(anyString())).thenAnswer(inv ->
                Optional.ofNullable(usersByPhone.get(inv.getArgument(0))));
        Mockito.when(userRepo.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            if (u.getId() == null) {
                u.setId(userIdSeq.getAndIncrement());
            }
            usersById.put(u.getId(), u);
            usersByPhone.put(u.getPhoneNumber(), u);
            return u;
        });
        Mockito.when(userRepo.findById(anyLong())).thenAnswer(inv ->
                 Optional.ofNullable(usersById.get(inv.getArgument(0))));
        SmsClient sms = Mockito.mock(SmsClient.class);
        Mockito.when(sms.sendOtpMessage(anyString(), anyString(), anyBoolean())).thenReturn(new SendSmsResponse());

        OtpMessageBuilder builder = Mockito.mock(OtpMessageBuilder.class);
        Mockito.when(builder.build(anyString())).thenAnswer(i -> "OTP:"+i.getArgument(0));
        

        OtpService.JwtSigner signer = new DummySigner(clock);

        service = new OtpService(this.redis, this.props, sms, builder, otpRepo, userRepo, signer, clock);
    }

    static class DummySigner implements OtpService.JwtSigner {
        private final Clock clock;
        private int seq = 0;
        DummySigner(Clock clock){this.clock=clock;}
        private String token(Long user,String sid){
            String header = Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
            String payload = String.format("{\"sub\":\"%d\",\"sid\":\"%s\",\"jti\":\"j%d\",\"exp\":%d}", user, sid, seq++, clock.instant().plusSeconds(3600).getEpochSecond());
            String body = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
            return header+"."+body+".";
        }
        public String signAccessToken(Long u,String s){ return token(u,s); }
        public String signRefreshToken(Long u,String s){ return token(u,s); }
    }

    @Test
    void sendAndVerifySuccess() {
        String phone = "9999999999";
        service.sendOtp(phone);
        String e164 = com.om.backend.util.PhoneNumberUtil1.toE164India(phone);
        String key  = "otp:" + e164;            // same prefix/format the service uses
        String otp  = store.get(key);
        assertNotNull(otp, "OTP should have been stored in Redis");

        Long userId = service.verifyOtp(phone, otp);
        assertNotNull(userId);
        assertTrue(userRepo.findById(userId).isPresent());
    }

    @Test
    void wrongOtpThrows() {
        String phone = "8888888888";
        service.sendOtp(phone);
        assertThrows(IllegalArgumentException.class, () -> service.verifyOtp(phone, "000000"));
    }

    @Test
    void expiredOtpThrows() {
        String phone = "7777777777";
        service.sendOtp(phone);
        String key = "otp:+917777777777";
        store.remove(key); // simulate TTL expiry
        assertThrows(IllegalArgumentException.class, () -> service.verifyOtp(phone, "123456"));
    }

    @Test
    void rateLimitPerMinuteExceeded() {
        SmsProperties props = new SmsProperties();
        props.getOtp().setDigits(6);
        props.getOtp().setTtlMinutes(5);
        props.getOtp().setPerMinuteLimit(1);
        props.getOtp().setPerHourLimit(10);
        props.getDlt().setContent("OTP {#var#}");

        // rebuild service with tighter limits
        SmsClient sms = Mockito.mock(SmsClient.class);
        Mockito.when(sms.sendOtpMessage(anyString(), anyString(), anyBoolean())).thenReturn(new SendSmsResponse());
        OtpMessageBuilder builder = Mockito.mock(OtpMessageBuilder.class);
        Mockito.when(builder.build(anyString())).thenAnswer(i -> "OTP:"+i.getArgument(0));
        StringRedisTemplate redis = Mockito.mock(StringRedisTemplate.class);
        ValueOperations<String,String> valueOps = Mockito.mock(ValueOperations.class);
        Mockito.when(redis.opsForValue()).thenReturn(valueOps);
        Map<String,String> s = new HashMap<>();
        Map<String,Long> e = new HashMap<>();
        Map<String,Long> c = new HashMap<>();
        Mockito.doAnswer(inv->{String k=inv.getArgument(0);String v=inv.getArgument(1);Duration ttl=inv.getArgument(2);s.put(k,v);e.put(k,clock.instant().plus(ttl).getEpochSecond());return null;}).when(valueOps).set(anyString(),anyString(),any(Duration.class));
        Mockito.when(valueOps.get(anyString())).thenAnswer(inv->{String k=inv.getArgument(0);Long ex=e.get(k);if(ex!=null && clock.instant().getEpochSecond()>ex){s.remove(k);return null;}return s.get(k);});
        Mockito.when(valueOps.increment(anyString())).thenAnswer(inv->{String k=inv.getArgument(0);Long v=c.getOrDefault(k,0L)+1;c.put(k,v);return v;});
        Mockito.when(redis.expire(anyString(), anyLong(), any(TimeUnit.class))).thenAnswer(inv->{String k=inv.getArgument(0);long t=inv.getArgument(1);TimeUnit u=inv.getArgument(2);e.put(k,clock.instant().plusSeconds(u.toSeconds(t)).getEpochSecond());return true;});
        Mockito.when(redis.delete(anyString())).thenAnswer(inv->{String k=inv.getArgument(0);s.remove(k);e.remove(k);c.remove(k);return true;});
        service = new OtpService(redis, props, sms, builder, otpRepo, userRepo, new DummySigner(clock), clock);

        String phone = "6666666666";
        service.sendOtp(phone);
        assertThrows(IllegalStateException.class, () -> service.sendOtp(phone));
    }

    @Test
    void rateLimitPerHourExceeded() {
        SmsProperties props = new SmsProperties();
        props.getOtp().setDigits(6);
        props.getOtp().setTtlMinutes(5);
        props.getOtp().setPerMinuteLimit(10);
        props.getOtp().setPerHourLimit(1);
        props.getDlt().setContent("OTP {#var#}");

        SmsClient sms = Mockito.mock(SmsClient.class);
        Mockito.when(sms.sendOtpMessage(anyString(), anyString(), anyBoolean())).thenReturn(new SendSmsResponse());
        OtpMessageBuilder builder = Mockito.mock(OtpMessageBuilder.class);
        Mockito.when(builder.build(anyString())).thenAnswer(i -> "OTP:"+i.getArgument(0));
        StringRedisTemplate redis = Mockito.mock(StringRedisTemplate.class);
        ValueOperations<String,String> valueOps = Mockito.mock(ValueOperations.class);
        Mockito.when(redis.opsForValue()).thenReturn(valueOps);
        Map<String,String> s = new HashMap<>();
        Map<String,Long> e = new HashMap<>();
        Map<String,Long> c = new HashMap<>();
        Mockito.doAnswer(inv->{String k=inv.getArgument(0);String v=inv.getArgument(1);Duration ttl=inv.getArgument(2);s.put(k,v);e.put(k,clock.instant().plus(ttl).getEpochSecond());return null;}).when(valueOps).set(anyString(),anyString(),any(Duration.class));
        Mockito.when(valueOps.get(anyString())).thenAnswer(inv->{String k=inv.getArgument(0);Long ex=e.get(k);if(ex!=null && clock.instant().getEpochSecond()>ex){s.remove(k);return null;}return s.get(k);});
        Mockito.when(valueOps.increment(anyString())).thenAnswer(inv->{String k=inv.getArgument(0);Long v=c.getOrDefault(k,0L)+1;c.put(k,v);return v;});
        Mockito.when(redis.expire(anyString(), anyLong(), any(TimeUnit.class))).thenAnswer(inv->{String k=inv.getArgument(0);long t=inv.getArgument(1);TimeUnit u=inv.getArgument(2);e.put(k,clock.instant().plusSeconds(u.toSeconds(t)).getEpochSecond());return true;});
        Mockito.when(redis.delete(anyString())).thenAnswer(inv->{String k=inv.getArgument(0);s.remove(k);e.remove(k);c.remove(k);return true;});
        service = new OtpService(redis, props, sms, builder, otpRepo, userRepo, new DummySigner(clock), clock);

        String phone = "7555555555";
        service.sendOtp(phone);
        assertThrows(IllegalStateException.class, () -> service.sendOtp(phone));
    }

    @Test
    void verifyOtp_redisHit_deletesAndReturnsUserId() {
        String phone = "9876543210"; // raw input
        String e164 = "+919876543210";
        String key = "otp:" + e164;
        when(valueOps.get(key)).thenReturn("123456");
        User user = new User();
        user.setId(42L);
        user.setPhoneNumber(e164);
        when(userRepo.findByPhoneNumber(e164)).thenReturn(Optional.of(user));

        Long id = service.verifyOtp(phone, "123456");
        assertEquals(42L, id);
        verify(redis).delete(key);
        verify(otpRepo, never()).findByPhoneNumber(any());
    }

    @Test
    void verifyOtp_noRedis_noAudit_throws() {
        props.getOtp().setPersistForAudit(false);
        when(valueOps.get(any())).thenReturn(null);

        assertThrows(IllegalArgumentException.class, () -> service.verifyOtp("9876543210", "000000"));
        verify(otpRepo, never()).findByPhoneNumber(any());
    }

    @Test
    void verifyOtp_dbFallback_whenEnabled() {
        props.getOtp().setPersistForAudit(true);
        when(valueOps.get(any())).thenReturn(null);
        String e164 = "+919876543210";
        String otp = "654321";
        Otp row = new Otp();
        row.setPhoneNumber(e164);
        row.setOtpCode(otp);
        row.setExpiredAt(Instant.now(clock).plusSeconds(60));
        when(otpRepo.findByPhoneNumber(e164)).thenReturn(Optional.of(row));
        User user = new User();
        user.setId(7L);
        user.setPhoneNumber(e164);
        when(userRepo.findByPhoneNumber(e164)).thenReturn(Optional.of(user));

        Long id = service.verifyOtp("9876543210", otp);
        assertEquals(7L, id);
        verify(otpRepo).delete(row);
    }
}
