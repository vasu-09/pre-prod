package com.om.backend.util;

import com.google.i18n.phonenumbers.PhoneNumberUtil;
import com.google.i18n.phonenumbers.Phonenumber;

/** India-only helpers. */
public final class PhoneNumberUtil1 {

    private static final PhoneNumberUtil U = PhoneNumberUtil.getInstance();
    private PhoneNumberUtil1() {}

    /** Returns +91XXXXXXXXXX — good for storage/logs. */
    public static String toE164India(String raw) {
        try {
            Phonenumber.PhoneNumber p = U.parse(raw, "IN");
            if (!U.isValidNumberForRegion(p, "IN")) {
                throw new IllegalArgumentException("Invalid Indian mobile: " + raw);
            }
            return U.format(p, PhoneNumberUtil.PhoneNumberFormat.E164);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid Indian mobile: " + raw, e);
        }
    }

    /** Returns the 10-digit national number (e.g., 9876543210). */
    public static String toIndiaNsn10(String raw) {
        try {
            Phonenumber.PhoneNumber p = U.parse(raw, "IN");
            if (!U.isValidNumberForRegion(p, "IN")) {
                throw new IllegalArgumentException("Invalid Indian mobile: " + raw);
            }
            String nsn = String.valueOf(p.getNationalNumber());
            if (!nsn.matches("^[6-9]\\d{9}$")) {
                throw new IllegalArgumentException("Not an Indian mobile (6-9 start): " + nsn);
            }
            return nsn;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid Indian mobile: " + raw, e);
        }
    }

    /** Returns 91 + 10-digit (no '+'), in case the provider wants “91XXXXXXXXXX”. */
    public static String toIndia91NoPlus(String raw) {
        return "91" + toIndiaNsn10(raw);
    }
}
