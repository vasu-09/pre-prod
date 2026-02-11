package com.om.backend.util;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Centralizes how we normalize Indian phone numbers before persisting or querying them.
 * It mirrors the OTP service logic so that contact sync, login, etc. all use the
 * same canonical representation (either NSN10 or 91XXXXXXXXXX based on configuration).
 */
@Component
public class PhoneNumberCanonicalizer {

    public PhoneNumberCanonicalizer() {}

    /**
     * Normalizes the incoming phone number into the format configured for SMS delivery/storage.
     * Returns {@code null} when the input is blank so callers can easily filter it out.
     */
    public String normalize(String rawPhone) {
        if (!StringUtils.hasText(rawPhone)) {
            return null;
        }
        return PhoneNumberUtil1.toE164IndiaLenient(rawPhone);
    }
}