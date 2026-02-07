package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.dto.ClaimPrekeyRequest;
import com.om.Real_Time_Communication.dto.DeviceBundleDto;
import com.om.Real_Time_Communication.dto.RegisterDto;
import com.om.Real_Time_Communication.dto.OneTimePrekeyDto;
import com.om.Real_Time_Communication.dto.SessionRecoveryRequest;
import com.om.Real_Time_Communication.dto.RegisterResponse;
import com.om.Real_Time_Communication.service.E2eeDeviceService;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/e2ee")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class E2eeDeviceController {

    private final E2eeDeviceService svc;

    public E2eeDeviceController(E2eeDeviceService svc) { this.svc = svc; }

    /** Register or refresh device bundle + (optional) batch of OTKs. */
    @PostMapping("/devices/register")
    public ResponseEntity<RegisterResponse> register(Principal principal, @RequestBody RegisterDto dto) {
        Long userId = Long.valueOf(principal.getName()); // or @RequestHeader("X-User-Id")
        boolean valid = svc.register(userId, dto);
        if (!valid) {
            return ResponseEntity.badRequest().body(new RegisterResponse(false, "invalid_signature"));
        }
        return ResponseEntity.ok(new RegisterResponse(true, null));
    }

    /** Upload more OTKs for an existing device. */
    @PostMapping("/devices/{deviceId}/prekeys")
    public void uploadPrekeys(Principal principal, @PathVariable String deviceId, @RequestBody List<OneTimePrekeyDto> prekeys) {
        Long userId = Long.valueOf(principal.getName());
        svc.addPrekeys(userId, deviceId, prekeys);
    }

    /** Fetch a single device bundle for a target user (identity + signed prekey). */
    @GetMapping("/users/{targetUserId}/devices/{deviceId}")
    public DeviceBundleDto fetchDevice(@PathVariable Long targetUserId, @PathVariable String deviceId) {
        return svc.getBundle(targetUserId, deviceId);
    }

    /** Discover target user's devices (non-consuming). */
    @GetMapping("/users/{targetUserId}/devices")
    public List<DeviceBundleDto> listDevices(@PathVariable Long targetUserId) {
        return svc.listBundles(targetUserId);
    }

    /** Claim (consume) one OTK for a target device and return the bundle. */
   @PostMapping("/claim-prekey")
    public DeviceBundleDto claimPrekey(@RequestParam(value = "userId", required = false) Long userId,
                                       @RequestParam(value = "targetUserId", required = false) Long targetUserId,
                                       @RequestParam(value = "deviceId", required = false) String deviceId,
                                       @RequestBody(required = false) ClaimPrekeyRequest body) {
        // Support both query-param callers (old clients) and JSON body (MoC frontend)
        Long resolvedUserId = userId != null ? userId
                : (targetUserId != null ? targetUserId : body != null ? body.getTargetUserId() : null);
        String resolvedDeviceId = deviceId != null ? deviceId : body != null ? body.getDeviceId() : null;

        if (resolvedUserId == null || resolvedDeviceId == null || resolvedDeviceId.isBlank()) {
            throw new IllegalArgumentException("userId/targetUserId and deviceId are required");
        }
        return svc.claimOneTimePrekey(resolvedUserId, resolvedDeviceId);
    }

    /** Get remaining OTK stock for your own device (UX prompt to replenish). */
    @GetMapping("/devices/{deviceId}/stock")
    public long stock(Principal principal, @PathVariable String deviceId) {
        Long userId = Long.valueOf(principal.getName());
        return svc.availablePrekeys(userId, deviceId);
    }

    @PostMapping("/recover-session")
    public DeviceBundleDto recoverSession(Principal principal, @RequestBody SessionRecoveryRequest req) {
        Long requesterUserId = Long.valueOf(principal.getName());
        return svc.recoverSession(requesterUserId, req);
    }
}
