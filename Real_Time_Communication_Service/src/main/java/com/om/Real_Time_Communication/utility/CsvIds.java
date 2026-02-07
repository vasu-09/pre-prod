package com.om.Real_Time_Communication.utility;

import java.util.ArrayList;
import java.util.List;

public final class CsvIds {
    public static List<Long> parse(String csv) {
        List<Long> out = new ArrayList<Long>();
        if (csv == null || csv.trim().isEmpty()) return out;
        String[] parts = csv.split(",");
        for (String p : parts) {
            try { out.add(Long.valueOf(p.trim())); } catch (Exception ignore) {}
        }
        return out;
    }
    private CsvIds() {}
}