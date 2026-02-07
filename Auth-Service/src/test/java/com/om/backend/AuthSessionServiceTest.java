package com.om.backend;

import com.om.backend.Config.SmsProperties;
import com.om.backend.Dto.SendSmsResponse;
import com.om.backend.Dto.SessionDto;
import com.om.backend.Repositories.OtpRepository;
import com.om.backend.Repositories.UserRepository;
import com.om.backend.Repositories.UserSessionRepository;
import com.om.backend.services.OtpService;
import com.om.backend.services.UserSessionService;
import com.om.backend.util.OtpMessageBuilder;
import com.om.backend.util.SmsClient;
import com.om.backend.util.JwtIntrospection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;

@DataJpaTest
class AuthSessionServiceTest {

    @Autowired
    OtpRepository otpRepo;
    @Autowired
    UserRepository userRepo;
    @Autowired
    UserSessionRepository sessionRepo;

    OtpService otpService;
    UserSessionService sessionService;
    Map<String,String> store;
    Map<String,Long> expires;
    Map<String,Long> counters;
    Clock clock;

    @BeforeEach
    void setup() {
        store = new HashMap<>();
        expires = new HashMap<>();
        counters = new HashMap<>();
        clock = Clock.fixed(Instant.parse("2023-01-01T00:00:00Z"), ZoneOffset.UTC);

        StringRedisTemplate redis = Mockito.mock(StringRedisTemplate.class);
        ValueOperations<String,String> valueOps = Mockito.mock(ValueOperations.class);
        Mockito.when(redis.opsForValue()).thenReturn(valueOps);
        Mockito.doAnswer(inv->{String k=inv.getArgument(0);String v=inv.getArgument(1);Duration ttl=inv.getArgument(2);store.put(k,v);expires.put(k,clock.instant().plus(ttl).getEpochSecond());return null;}).when(valueOps).set(anyString(),anyString(),any(Duration.class));
        Mockito.when(valueOps.get(anyString())).thenAnswer(inv->{String k=inv.getArgument(0);Long ex=expires.get(k);if(ex!=null && clock.instant().getEpochSecond()>ex){store.remove(k);return null;}return store.get(k);});
        Mockito.when(valueOps.increment(anyString())).thenAnswer(inv->{String k=inv.getArgument(0);Long v=counters.getOrDefault(k,0L)+1;counters.put(k,v);return v;});
        Mockito.when(redis.expire(anyString(), anyLong(), any(TimeUnit.class))).thenAnswer(inv->{String k=inv.getArgument(0);long t=inv.getArgument(1);TimeUnit u=inv.getArgument(2);expires.put(k,clock.instant().plusSeconds(u.toSeconds(t)).getEpochSecond());return true;});
        Mockito.when(redis.delete(anyString())).thenAnswer(inv->{String k=inv.getArgument(0);store.remove(k);expires.remove(k);counters.remove(k);return true;});

        SmsProperties props = new SmsProperties();
        props.getOtp().setDigits(6);
        props.getOtp().setTtlMinutes(5);
        props.getOtp().setPerMinuteLimit(5);
        props.getOtp().setPerHourLimit(5);
        props.getDlt().setContent("OTP {#var#}");

        SmsClient sms = Mockito.mock(SmsClient.class);
        Mockito.when(sms.sendOtpMessage(anyString(), anyString(), anyBoolean())).thenReturn(new SendSmsResponse());
        OtpMessageBuilder builder = Mockito.mock(OtpMessageBuilder.class);
        Mockito.when(builder.build(anyString())).thenAnswer(i -> "OTP:"+i.getArgument(0));

        OtpService.JwtSigner signer = new DummySigner(clock);
        otpService = new OtpService(redis, props, sms, builder, otpRepo, userRepo, signer, clock);
        sessionService = new UserSessionService(userRepo, sessionRepo);
    }

    static class DummySigner implements OtpService.JwtSigner {
        private final Clock clock; private int seq=0; DummySigner(Clock c){clock=c;}
        private String token(Long u,String sid){
            String header = Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
            String payload = String.format("{\"sub\":\"%d\",\"sid\":\"%s\",\"jti\":\"j%d\",\"exp\":%d}",u,sid,seq++,clock.instant().plusSeconds(3600).getEpochSecond());
            String body = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
            return header+"."+body+".";
        }
        public String signAccessToken(Long u,String s){return token(u,s);} public String signRefreshToken(Long u,String s){return token(u,s);} }

    @Test
    void loginCreatesSessionAndBindsRefresh() throws Exception {
        String phone="9999999999";
        otpService.sendOtp(phone);
        String otp=store.get("otp:+919999999999");
        Long userId=otpService.verifyOtp(phone, otp);
        String sid=UUID.randomUUID().toString();
        sessionService.createOrUpdateSession(userId,sid,"Pixel","android","1.0");
        String access=otpService.mintAccessToken(userId,sid);
        String refresh=otpService.mintRefreshToken(userId,sid);
        sessionService.bindRefreshToken(userId,sid,refresh);
        assertNotNull(access);
        var session=sessionRepo.findById(sid).orElseThrow();
        assertNotNull(session.getRefreshTokenHash());
        assertNotNull(session.getRefreshJti());
    }

    @Test
    void refreshRotationAndMismatch() {
        String phone="8888888888";
        otpService.sendOtp(phone);
        String otp=store.get("otp:+918888888888");
        Long userId=otpService.verifyOtp(phone, otp);
        String sid=UUID.randomUUID().toString();
        sessionService.createOrUpdateSession(userId,sid,null,null,null);
        String oldRefresh=otpService.mintRefreshToken(userId,sid);
        sessionService.bindRefreshToken(userId,sid,oldRefresh);
        String newRefresh=otpService.mintRefreshToken(userId,sid);
        sessionService.rotateRefreshToken(userId,sid,oldRefresh,newRefresh);
        var s=sessionRepo.findById(sid).orElseThrow();
        byte[] expected; try{expected=MessageDigest.getInstance("SHA-256").digest(newRefresh.getBytes(StandardCharsets.UTF_8));}catch(Exception e){throw new RuntimeException(e);}
        assertArrayEquals(expected,s.getRefreshTokenHash());
        assertThrows(IllegalArgumentException.class,()->sessionService.rotateRefreshToken(userId,sid,"bad",otpService.mintRefreshToken(userId,sid)));
    }

    @Test
    void sessionsListAndRevoke() {
        String phone="7777777777"; otpService.sendOtp(phone); String otp=store.get("otp:+917777777777"); Long uid=otpService.verifyOtp(phone, otp);
        sessionService.createOrUpdateSession(uid,"s1",null,null,null);
        sessionService.createOrUpdateSession(uid,"s2",null,null,null);
        List<SessionDto> sessions=sessionService.listSessions(uid,"s1");
        assertEquals(2,sessions.size());
        sessionService.revokeSession(uid,"s1");
        assertNotNull(sessionRepo.findById("s1").orElseThrow().getRevokedAt());
        String token=otpService.mintAccessToken(uid,"s2");
        sessionService.revokeCurrentSession(uid,token);
        assertNotNull(sessionRepo.findById("s2").orElseThrow().getRevokedAt());
    }

    @Test
    void registerDeviceUpdatesFcm() {
        String phone="6666666666"; otpService.sendOtp(phone); String otp=store.get("otp:+916666666666"); Long uid=otpService.verifyOtp(phone, otp);
        String sid=UUID.randomUUID().toString();
        sessionService.createOrUpdateSession(uid,sid,null,null,null);
        sessionService.registerOrUpdateDevice(uid,sid,"fcm123","Pixel","1.0","android");
        assertEquals("fcm123",sessionRepo.findById(sid).orElseThrow().getFcmToken());
    }
}
