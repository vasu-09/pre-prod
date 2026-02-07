package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.E2eeDeviceRepository;
import com.om.Real_Time_Communication.Repository.E2eeOneTimePrekeyRepository;
import com.om.Real_Time_Communication.dto.DeviceBundleDto;
import com.om.Real_Time_Communication.dto.RegisterDto;
import com.om.Real_Time_Communication.models.E2eeDevice;
import com.om.Real_Time_Communication.dto.OneTimePrekeyDto;
import com.om.Real_Time_Communication.dto.SessionRecoveryRequest;
import com.om.Real_Time_Communication.models.E2eeOneTimePrekey;
import com.om.Real_Time_Communication.security.Ed25519Verifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import org.slf4j.Logger;
import java.util.HexFormat;
import org.slf4j.LoggerFactory;
import java.util.List;

@Service
public class E2eeDeviceService {

    private static final Logger log = LoggerFactory.getLogger(E2eeDeviceService.class);

    private final E2eeDeviceRepository deviceRepo;
    private final E2eeOneTimePrekeyRepository prekeyRepo;

    public E2eeDeviceService(E2eeDeviceRepository deviceRepo, E2eeOneTimePrekeyRepository prekeyRepo) {
        this.deviceRepo = deviceRepo; this.prekeyRepo = prekeyRepo;
    }

    /** Register/refresh a device bundle and upload optional batch of OTKs. */
    @Transactional
    public boolean register(Long userId, RegisterDto dto) {
        require(dto.getDeviceId() != null && !dto.getDeviceId().isBlank(), "deviceId required");
        require(dto.getIdentityKeyPub()!=null && dto.getIdentityKeyPub().length==32, "identityKeyPub invalid");
        require(dto.getSignedPrekeyPub()!=null && dto.getSignedPrekeyPub().length==32, "signedPrekeyPub invalid");
        require(dto.getSignedPrekeySig()!=null && dto.getSignedPrekeySig().length==64, "signedPrekeySig invalid");

        log.info("E2EE register user={} device={} identityPub={} signedPrekeyPub={} sig={}",
                userId,
                dto.getDeviceId(),
                HexFormat.of().formatHex(dto.getIdentityKeyPub()),
                HexFormat.of().formatHex(dto.getSignedPrekeyPub()),
                HexFormat.of().formatHex(dto.getSignedPrekeySig()));

        // Verify signedPrekeySig = Ed25519_sign(identityKeyPriv, signedPrekeyPub)
        boolean ok = Ed25519Verifier.verify(dto.getIdentityKeyPub(), dto.getSignedPrekeyPub(), dto.getSignedPrekeySig());
        if (!ok) {
            log.warn("signedPrekeySig verification failed for user {} device {} — rejecting bundle", userId, dto.getDeviceId());
            return false;
        }

        E2eeDevice dev = deviceRepo.findByUserIdAndDeviceId(userId, dto.getDeviceId()).orElseGet(E2eeDevice::new);
        boolean existing = dev.getId() != null;
        boolean keyChanged = existing && (!java.util.Arrays.equals(dev.getIdentityKeyPub(), dto.getIdentityKeyPub())
                || !java.util.Arrays.equals(dev.getSignedPrekeyPub(), dto.getSignedPrekeyPub()));
        dev.setUserId(userId);
        dev.setDeviceId(dto.getDeviceId());
        dev.setName(dto.getName());
        dev.setPlatform(dto.getPlatform());
        dev.setIdentityKeyPub(dto.getIdentityKeyPub());
        dev.setSignedPrekeyPub(dto.getSignedPrekeyPub());
        dev.setSignedPrekeySig(dto.getSignedPrekeySig());
        dev.setLastSeen(Instant.now());
        deviceRepo.save(dev);

        if (keyChanged) {
            prekeyRepo.deleteByUserIdAndDeviceId(userId, dto.getDeviceId());
            log.info("E2EE bundle refreshed; purged old OTKs for user={} device={} after key change", userId, dto.getDeviceId());
        }

        if (dto.getOneTimePrekeys()!=null) {
            for (OneTimePrekeyDto otk : dto.getOneTimePrekeys()) {
                if (otk == null || otk.getPrekeyPub() == null || otk.getPrekeyPub().length == 0) continue;
                E2eeOneTimePrekey p = new E2eeOneTimePrekey();
                p.setUserId(userId); p.setDeviceId(dto.getDeviceId());
                p.setPrekeyId(otk.getPrekeyId());
                p.setPrekeyPub(otk.getPrekeyPub());
                prekeyRepo.save(p);
            }
            log.info("E2EE stored {} OTKs for user={} device={} (examples id={} ...)", dto.getOneTimePrekeys().size(), userId, dto.getDeviceId(),
                    dto.getOneTimePrekeys().isEmpty() ? null : dto.getOneTimePrekeys().get(0).getPrekeyId());
        } else {
            log.warn("E2EE register user={} device={} with no OTKs uploaded", userId, dto.getDeviceId());
        }
        return true;
    }

    /** Claim one OTK for a target device (consumes it); returns bundle+OTK (or null otk). */
    @Transactional
    public DeviceBundleDto claimOneTimePrekey(Long targetUserId, String deviceId) {
        E2eeDevice dev = deviceRepo.findByUserIdAndDeviceId(targetUserId, deviceId)
                .orElseThrow(() -> new IllegalArgumentException("device not found"));
        Long otkId = null;
        byte[] otk = null;
        var avail = prekeyRepo.findAvailable(targetUserId, deviceId);
        if (!avail.isEmpty()) {
            var first = avail.get(0);
            otkId = first.getPrekeyId() != null ? first.getPrekeyId().longValue() : first.getId();
            otk = first.getPrekeyPub();
            first.setConsumed(true);
            prekeyRepo.save(first);
            log.info("E2EE claimed OTK user={} device={} otkId={} remaining={}", targetUserId, deviceId, otkId,
                    prekeyRepo.countByUserIdAndDeviceIdAndConsumedFalse(targetUserId, deviceId));
        } else {
            log.warn("E2EE no available OTK user={} device={}", targetUserId, deviceId);
        }
        return new DeviceBundleDto(dev.getDeviceId(), dev.getIdentityKeyPub(), dev.getSignedPrekeyPub(), dev.getSignedPrekeySig(), otkId, otk);
    }

    /** Fetch a single device bundle without consuming any one-time prekeys. */
    @Transactional(readOnly = true)
    public DeviceBundleDto getBundle(Long targetUserId, String deviceId) {
        E2eeDevice dev = deviceRepo.findByUserIdAndDeviceId(targetUserId, deviceId)
                .orElseThrow(() -> new IllegalArgumentException("device not found"));
        return new DeviceBundleDto(dev.getDeviceId(), dev.getIdentityKeyPub(), dev.getSignedPrekeyPub(), dev.getSignedPrekeySig(), null, null);
    }

    /** List device bundles (without consuming OTKs). */
    @Transactional(readOnly = true)
    public List<DeviceBundleDto> listBundles(Long targetUserId) {
        var devs = deviceRepo.findByUserId(targetUserId);
        var out = new ArrayList<DeviceBundleDto>(devs.size());
        for (var d : devs) {
            out.add(new DeviceBundleDto(d.getDeviceId(), d.getIdentityKeyPub(), d.getSignedPrekeyPub(), d.getSignedPrekeySig(), null,null));
        }
        return out;
    }

    /** Upload additional OTKs for an existing device. */
    @Transactional
    public void addPrekeys(Long userId, String deviceId, List<OneTimePrekeyDto> prekeys) {
        deviceRepo.findByUserIdAndDeviceId(userId, deviceId)
                .orElseThrow(() -> new IllegalArgumentException("device not found"));
        if (prekeys == null) return;
        for (OneTimePrekeyDto otk : prekeys) {
            if (otk == null || otk.getPrekeyPub() == null || otk.getPrekeyPub().length == 0) continue;
            E2eeOneTimePrekey p = new E2eeOneTimePrekey();
            p.setUserId(userId); p.setDeviceId(deviceId);
            p.setPrekeyId(otk.getPrekeyId());
            p.setPrekeyPub(otk.getPrekeyPub());
            prekeyRepo.save(p);
        }
    }

    @Transactional
    public DeviceBundleDto recoverSession(Long requesterUserId, SessionRecoveryRequest req) {
        require(req != null, "request required");
        require(req.getTargetUserId() != null, "targetUserId required");
        require(req.getTargetDeviceId() != null && !req.getTargetDeviceId().isBlank(), "targetDeviceId required");
        log.warn("E2EE recovery reason={} requesterUser={} device={} targetUser={} targetDevice={} sessionId={} keyVersion={}",
                req.getFailureReason(),
                requesterUserId,
                req.getRequesterDeviceId(),
                req.getTargetUserId(),
                req.getTargetDeviceId(),
                req.getSessionId(),
                req.getKeyVersion());
        return claimOneTimePrekey(req.getTargetUserId(), req.getTargetDeviceId());
    }

    @Transactional(readOnly = true)
    public long availablePrekeys(Long userId, String deviceId) {
        return prekeyRepo.countByUserIdAndDeviceIdAndConsumedFalse(userId, deviceId);
    }

    private static void require(boolean cond, String msg) {
        if (!cond) throw new IllegalArgumentException(msg);
    }
}
