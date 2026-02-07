package com.om.Real_Time_Communication;

import com.om.Real_Time_Communication.Repository.E2eeDeviceRepository;
import com.om.Real_Time_Communication.Repository.E2eeOneTimePrekeyRepository;
import com.om.Real_Time_Communication.dto.RegisterDto;
import com.om.Real_Time_Communication.dto.SessionRecoveryRequest;
import com.om.Real_Time_Communication.dto.OneTimePrekeyDto;
import com.om.Real_Time_Communication.models.E2eeDevice;
import com.om.Real_Time_Communication.service.E2eeDeviceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.Signature;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class E2eeDeviceServiceTest {

    @Autowired
    private E2eeDeviceRepository deviceRepository;

    @Autowired
    private E2eeOneTimePrekeyRepository prekeyRepository;

    private E2eeDeviceService service;

    @BeforeEach
    void setUp() {
        service = new E2eeDeviceService(deviceRepository, prekeyRepository);
    }

    @Test
    void registerReplacesKeysOnReinstallAndPurgesOldPrekeys() throws Exception {
        KeyPair identityV1 = generateKeyPair();
        KeyPair signedV1 = generateKeyPair();
        RegisterDto v1 = buildRegister("device-A", identityV1, signedV1, List.of(
                prekey(10, new byte[]{1, 2, 3}),
                prekey(11, new byte[]{4, 5, 6})
        ));

        assertThat(service.register(10L, v1)).isTrue();
        assertThat(prekeyRepository.countByUserIdAndDeviceIdAndConsumedFalse(10L, "device-A")).isEqualTo(2);

        KeyPair identityV2 = generateKeyPair();
        KeyPair signedV2 = generateKeyPair();
        RegisterDto v2 = buildRegister("device-A", identityV2, signedV2, List.of(prekey(15, new byte[]{7, 8, 9})));

        assertThat(service.register(10L, v2)).isTrue();

        E2eeDevice device = deviceRepository.findByUserIdAndDeviceId(10L, "device-A").orElseThrow();
        assertThat(device.getIdentityKeyPub()).containsExactly(rawPublicKey(identityV2));
        assertThat(device.getSignedPrekeyPub()).containsExactly(rawPublicKey(signedV2));
        assertThat(prekeyRepository.countByUserIdAndDeviceIdAndConsumedFalse(10L, "device-A")).isEqualTo(1);
    }

    @Test
    void claimOneTimePrekeyConsumesAndTracksAvailability() throws Exception {
        KeyPair identity = generateKeyPair();
        KeyPair signed = generateKeyPair();
        RegisterDto register = buildRegister("device-B", identity, signed, List.of(
                prekey(21, new byte[]{10, 11, 12}),
                prekey(22, new byte[]{13, 14, 15})
        ));
        assertThat(service.register(22L, register)).isTrue();

        var bundle = service.claimOneTimePrekey(22L, "device-B");
        assertThat(bundle.getOneTimePrekeyId()).isNotNull();
        assertThat(bundle.getOneTimePrekeyPub()).containsExactly(new byte[]{10, 11, 12});
        assertThat(prekeyRepository.countByUserIdAndDeviceIdAndConsumedFalse(22L, "device-B")).isEqualTo(1);
    }

    @Test
    void recoverSessionFetchesFreshPrekeyAfterFailure() throws Exception {
        KeyPair identity = generateKeyPair();
        KeyPair signed = generateKeyPair();
        RegisterDto register = buildRegister("device-C", identity, signed, List.of(prekey(30, new byte[]{20, 21, 22})));
        assertThat(service.register(33L, register)).isTrue();

        SessionRecoveryRequest request = new SessionRecoveryRequest();
        request.setTargetUserId(33L);
        request.setTargetDeviceId("device-C");
        request.setRequesterDeviceId("device-X");
        request.setFailureReason("bad_mac");
        request.setSessionId("session-123");
        request.setKeyVersion("v1");

        var bundle = service.recoverSession(99L, request);
        assertThat(bundle.getOneTimePrekeyPub()).containsExactly(new byte[]{20, 21, 22});
        assertThat(prekeyRepository.countByUserIdAndDeviceIdAndConsumedFalse(33L, "device-C")).isZero();
    }

    private RegisterDto buildRegister(String deviceId, KeyPair identityKey, KeyPair signedPrekey, List<OneTimePrekeyDto> otks) throws Exception {
        byte[] identityPub = rawPublicKey(identityKey);
        byte[] signedPrekeyPub = rawPublicKey(signedPrekey);
        byte[] signature = sign(identityKey.getPrivate(), signedPrekeyPub);

        RegisterDto dto = new RegisterDto();
        dto.setDeviceId(deviceId);
        dto.setIdentityKeyPub(identityPub);
        dto.setSignedPrekeyPub(signedPrekeyPub);
        dto.setSignedPrekeySig(signature);
        dto.setOneTimePrekeys(otks);
        return dto;
    }

    private OneTimePrekeyDto prekey(int id, byte[] pub) {
        OneTimePrekeyDto dto = new OneTimePrekeyDto();
        dto.setPrekeyId(id);
        dto.setPrekeyPub(pub);
        return dto;
    }

    private KeyPair generateKeyPair() throws Exception {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("Ed25519");
        return kpg.generateKeyPair();
    }

    private byte[] rawPublicKey(KeyPair kp) {
        return rawPublicKey(kp.getPublic().getEncoded());
    }

    private byte[] rawPublicKey(byte[] encoded) {
        return java.util.Arrays.copyOfRange(encoded, encoded.length - 32, encoded.length);
    }

    private byte[] sign(PrivateKey priv, byte[] data) throws Exception {
        Signature sig = Signature.getInstance("Ed25519");
        sig.initSign(priv);
        sig.update(data);
        return sig.sign();
    }
}
