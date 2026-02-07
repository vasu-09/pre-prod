package com.om.backend.util;

import com.om.backend.Config.SmsProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Centralizes how we normalize Indian phone numbers before persisting or querying them.
 * It mirrors the OTP service logic so that contact sync, login, etc. all use the
 * same canonical representation (either NSN10 or 91XXXXXXXXXX based on configuration).
 */
@Component
public class PhoneNumberCanonicalizer {

    private final SmsProperties smsProperties;

    public PhoneNumberCanonicalizer(SmsProperties smsProperties) {
        this.smsProperties = smsProperties;
    }

    /**
     * Normalizes the incoming phone number into the format configured for SMS delivery/storage.
     * Returns {@code null} when the input is blank so callers can easily filter it out.
     */
    public String normalize(String rawPhone) {
        if (!StringUtils.hasText(rawPhone)) {
            return null;
        }

        if ("NSN10".equalsIgnoreCase(smsProperties.getNumberFormat())) {
            return PhoneNumberUtil1.toIndiaNsn10(rawPhone);
        }

        // Default is "CC91" (91 + national 10 digits without '+').
        return PhoneNumberUtil1.toIndia91NoPlus(rawPhone);
    }
}
