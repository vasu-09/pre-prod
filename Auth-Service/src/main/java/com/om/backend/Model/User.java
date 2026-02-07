package com.om.backend.Model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

@Entity
@Data
@Table(name = "users")
@Getter
@Setter
public class User {
        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id; // Unique user ID

        private String phoneNumber; // Phone number used for login
        private String userName; // Full name of the user
        private String email; // Optional, for recovery and notifications
        private String avatarUrl; // URL to the user's avatar image
        private boolean isActive; // Indicates if the user is active (if they are blocked or deactivated)
        private boolean isPremium; // Indicates if the user has a premium subscription
        private Instant createdAt; // When the user registered
        private Instant updatedAt; // Last time the user information was updated
        @Column(length = 512)
        private String avatarKey;  // e.g. "avatars/<userId>/v4/<hash>.jpg"

        @Column
        private Instant avatarUpdatedAt;

        @OneToMany(mappedBy = "user")
        private List<Otp> otps; // List of OTPs generated for the user (1-to-many relationship)
        
        @JdbcTypeCode(SqlTypes.JSON)
        @Column(name = "notification_prefs", columnDefinition = "json", nullable = false)
        private NotificationPreferences notificationPrefs = new NotificationPreferences();

       @JdbcTypeCode(SqlTypes.JSON)
        @Column(name = "privacy_settings", columnDefinition = "json", nullable = false)
        private PrivacySettings privacySettings = new PrivacySettings();

        @Column(name = "prefs_updated_at", nullable = false)
        private Instant prefsUpdatedAt = Instant.now();


        // --- getters/setters ---
        public NotificationPreferences getNotificationPrefs() { return notificationPrefs; }
        public void setNotificationPrefs(NotificationPreferences v) { this.notificationPrefs = v; }
        public PrivacySettings getPrivacySettings() { return privacySettings; }
        public void setPrivacySettings(PrivacySettings v) { this.privacySettings = v; }
        public Instant getPrefsUpdatedAt() { return prefsUpdatedAt; }
        public void setPrefsUpdatedAt(Instant prefsUpdatedAt) { this.prefsUpdatedAt = prefsUpdatedAt; }
        public Long getId() {
                return id;
        }

        public void setId(Long id) {
                this.id = id;
        }

        public String getPhoneNumber() {
                return phoneNumber;
        }

        public void setPhoneNumber(String phoneNumber) {
                this.phoneNumber = phoneNumber;
        }

        public String getUserName() {
                return userName;
        }

        public void setUserName(String userName) {
                this.userName = userName;
        }

        public String getEmail() {
                return email;
        }

        public void setEmail(String email) {
                this.email = email;
        }

        public String getAvatarUrl() {
                return avatarUrl;
        }

        public void setAvatarUrl(String avatarUrl) {
                this.avatarUrl = avatarUrl;
        }

        public String getAvatarKey() {
                return avatarKey;
        }

        public void setAvatarKey(String avatarKey) {
                this.avatarKey = avatarKey;
        }

        public Instant getAvatarUpdatedAt() {
                return avatarUpdatedAt;
        }

        public void setAvatarUpdatedAt(Instant avatarUpdatedAt) {
                this.avatarUpdatedAt = avatarUpdatedAt;
        }

        public boolean isPremium() {
                return isPremium;
        }

        public void setPremium(boolean premium) {
                isPremium = premium;
        }

        public boolean isActive() {
                return isActive;
        }

        public void setActive(boolean active) {
                isActive = active;
        }

        public Instant getCreatedAt() {
                return createdAt;
        }

        public void setCreatedAt(Instant createdAt) {
                this.createdAt = createdAt;
        }

        public Instant getUpdatedAt() {
                return updatedAt;
        }

        public void setUpdatedAt(Instant updatedAt) {
                this.updatedAt = updatedAt;
        }

        public List<Otp> getOtps() {
                return otps;
        }

        public void setOtps(List<Otp> otps) {
                this.otps = otps;
        }
}
