package com.om.backend.Model;


public class PrivacySettings {
    public boolean readReceipts = true;
    public boolean typingIndicators = true;
    public String  lastSeenVisibility = "contacts";      // "everyone"|"contacts"|"nobody"
    public String  profilePhotoVisibility = "contacts";
    public String  onlineStatusVisibility = "contacts";
}