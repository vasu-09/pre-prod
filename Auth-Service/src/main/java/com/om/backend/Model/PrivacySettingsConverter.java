package com.om.backend.Model;

import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class PrivacySettingsConverter extends JsonConverter<PrivacySettings> {
    public PrivacySettingsConverter() { super(PrivacySettings.class); }
}