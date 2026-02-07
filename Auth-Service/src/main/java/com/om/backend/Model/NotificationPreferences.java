package com.om.backend.Model;

public class NotificationPreferences {
    public static class Ringtone { public String id; public String title; public String uri; }

    public static class Channel {
        public boolean enabled = true;
        public boolean vibrate = true;
        public Ringtone tone;      // for messages (UI-only on Android)
        public Ringtone ringtone;  // for calls   (UI-only on Android)
    }

    public Channel messages = new Channel();
    public Channel calls    = new Channel();

    // Optional:
    public static class QuietHours { public String start; public String end; } // "22:00","07:00"
    public QuietHours quietHours;
    public String previewPolicy = "show"; // "show" | "hide"
}