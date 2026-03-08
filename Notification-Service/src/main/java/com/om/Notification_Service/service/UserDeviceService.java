package com.om.Notification_Service.service;

import com.om.Notification_Service.dto.RegisterUserDeviceRequest;
import com.om.Notification_Service.models.UserDevice;
import com.om.Notification_Service.repository.UserDeviceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class UserDeviceService {
    private final UserDeviceRepository userDeviceRepository;

    public UserDeviceService(UserDeviceRepository userDeviceRepository) {
        this.userDeviceRepository = userDeviceRepository;
    }

    @Transactional
    public void upsert(RegisterUserDeviceRequest req) {
        if (req == null || req.getUserId() == null || !StringUtils.hasText(req.getSessionId())) {
            throw new IllegalArgumentException("userId and sessionId are required");
        }

        UserDevice device = userDeviceRepository.findByUserIdAndSessionId(req.getUserId(), req.getSessionId())
                .orElseGet(UserDevice::new);

        device.setUserId(req.getUserId());
        device.setSessionId(req.getSessionId());
        device.setFcmToken(req.getFcmToken());
        if (StringUtils.hasText(req.getPlatform())) {
            device.setPlatform(req.getPlatform());
        }
        if (StringUtils.hasText(req.getDeviceModel())) {
            device.setDeviceModel(req.getDeviceModel());
        }
        if (StringUtils.hasText(req.getAppVersion())) {
            device.setAppVersion(req.getAppVersion());
        }

        userDeviceRepository.save(device);
    }
}