package com.om.Real_Time_Communication.config;

import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Provides a Google Cloud Storage client bean. Uses application default
 * credentials so the service account JSON pointed to by
 * {@code GOOGLE_APPLICATION_CREDENTIALS} or other ADC mechanisms is used.
 * Excluded from the {@code test} profile where tests typically mock the
 * Storage service.
 */
@Configuration
public class StorageConfig {

    @Bean
    @Profile("!test")
    public Storage storage() {
        return StorageOptions.getDefaultInstance().getService();
    }
}
