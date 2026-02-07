package com.om.backend.services;

import com.om.backend.Dto.OneTimePreKeyDto;
import com.om.backend.Dto.PreKeyBundleDto;
import com.om.backend.Dto.PublicPreKeyBundle;
import com.om.backend.Model.OneTimePreKeyEntity;
import com.om.backend.Model.PreKeyBundleEntity;
import com.om.backend.Model.User;
import com.om.backend.Repositories.OneTimePreKeyRepository;
import com.om.backend.Repositories.PreKeyBundleRepository;
import com.om.backend.Repositories.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PreKeyBundleService {

    @Autowired
    private  PreKeyBundleRepository metaRepo;
    @Autowired
    private  OneTimePreKeyRepository oneRepo;
    @Autowired
    private  UserRepository userRepo;

    /** Create or update identity + signed prekey (“meta”) for the user/device. */
    @Transactional
    public void saveOrUpdateBundle(Long userId, PreKeyBundleDto dto) {
        var user = userRepo.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "User not found for id: " + userId));

        int deviceId = dto.getDeviceId() == 0 ? 1 : dto.getDeviceId();

        var meta = metaRepo.findByUserIdAndDeviceId(user.getId(), deviceId)
                .orElseGet(PreKeyBundleEntity::new);

        meta.setUserId(user.getId());
        meta.setDeviceId(deviceId);
        meta.setRegistrationId(dto.getRegistrationId());
        meta.setIdentityKey(dto.getIdentityKey());
        meta.setSignedPreKeyId(dto.getSignedPreKeyId());
        meta.setSignedPreKeyPublic(dto.getSignedPreKeyPublic());
        meta.setSignedPreKeySignature(dto.getSignedPreKeySignature());
        meta.setUpdatedAt(Instant.now());

        metaRepo.save(meta);

        // If your DTO ALSO carries a batch of one-time prekeys, persist them here.
        // for (OneTimePreKeyDto k : dto.getOneTimePreKeys()) { ... oneRepo.save(...) }
    }

    /** Upload a batch of one-time prekeys (preferred, separate endpoint). */
    @Transactional
    public void uploadOneTimePreKeys(Long userId, int deviceId, List<OneTimePreKeyDto> batch) {
        var user = userRepo.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "User not found for id: " + userId));
        if (deviceId == 0) deviceId = 1;

        for (var k : batch) {
            var e = new OneTimePreKeyEntity();
            e.setUserId(user.getId());
            e.setDeviceId(deviceId);
            e.setPreKeyId(k.getPreKeyId());
            e.setPreKeyPublic(k.getPreKeyPublic());
            oneRepo.save(e);
        }
    }

    /** Fetch bundle for recipient: identity + signedPreKey (+ consume one one-time prekey). */
    @Transactional
    public PublicPreKeyBundle consumeOneTimeBundleForPhone(String phone) {
        var user = userRepo.findByPhoneNumber(phone)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException(
                        "User not found for phone: " + phone));

        int deviceId = 1; // single-device for now
        var meta = metaRepo.findByUserIdAndDeviceId(user.getId(), deviceId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException(
                        "No prekey meta for user/device"));

        // Lock & pick oldest unconsumed one-time prekey
        OneTimePreKeyEntity one = null;
        var list = oneRepo.lockFindOldestUnconsumed(user.getId(), deviceId);
        if (!list.isEmpty()) {
            one = list.get(0);
            one.setConsumed(true);
            one.setConsumedAt(Instant.now());
            oneRepo.save(one);
        }

        return new PublicPreKeyBundle(
                meta.getRegistrationId(),
                meta.getDeviceId(),
                meta.getIdentityKey(),
                meta.getSignedPreKeyId(),
                meta.getSignedPreKeyPublic(),
                meta.getSignedPreKeySignature(),
                one != null ? one.getPreKeyId() : null,
                one != null ? one.getPreKeyPublic() : null
        );
    }
}
