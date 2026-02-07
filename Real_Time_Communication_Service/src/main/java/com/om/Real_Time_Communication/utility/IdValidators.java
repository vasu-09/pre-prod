package com.om.Real_Time_Communication.utility;

import java.util.regex.Pattern;

public final class IdValidators {
    private static final Pattern ULID = Pattern.compile("^[0-9A-HJKMNP-TV-Z]{26}$");
    private static final Pattern UUIDV7 = Pattern.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    );
    public static boolean isClientMsgId(String s) {
        if (s == null) return false;
        return ULID.matcher(s).matches() || UUIDV7.matcher(s).matches();
    }
    private IdValidators() {}
}
