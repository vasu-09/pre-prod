package com.om.backend.Model;


import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class NotificationPrefsConverter extends JsonConverter<NotificationPreferences> {
    public NotificationPrefsConverter() { super(NotificationPreferences.class); }
}
