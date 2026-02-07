package com.om.backend.services;

import com.om.backend.Dto.UserProfileDto;
import com.om.backend.Model.NotificationPreferences;
import com.om.backend.Model.PrivacySettings;
import com.om.backend.Model.User;
import com.om.backend.Model.UserChatPrefs;

import com.om.backend.Repositories.UserChatPrefsRepository;
import com.om.backend.Repositories.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepo;
    private final UserChatPrefsRepository ucpRepo;


    private static final Logger log = LoggerFactory.getLogger(OtpService.class);

    public UserService(UserRepository userRepo, UserChatPrefsRepository ucpRepo) {
        this.userRepo = userRepo;
        this.ucpRepo = ucpRepo;
    }

    // -------- Profile (if you need it here) --------
    @Transactional(readOnly = true)
    public User getMe(Long userId) {
        return userRepo.findById(userId).orElseThrow();
    }

    // -------- Notification preferences --------
    @Transactional(readOnly = true)
    public NotificationPreferences getNotificationPreferences(Long userId) {
        return userRepo.findById(userId).orElseThrow().getNotificationPrefs();
    }

    @Transactional
    public NotificationPreferences updateNotificationPreferences(Long userId, NotificationPreferences in) {
        User u = userRepo.findById(userId).orElseThrow();
        u.setNotificationPrefs(in);
        u.setPrefsUpdatedAt(Instant.now());
        userRepo.save(u);
        return u.getNotificationPrefs();
    }

    // -------- Privacy settings --------
    @Transactional(readOnly = true)
    public PrivacySettings getPrivacy(Long userId) {
        return userRepo.findById(userId).orElseThrow().getPrivacySettings();
    }

    @Transactional
    public PrivacySettings updatePrivacy(Long userId, PrivacySettings in) {
        User u = userRepo.findById(userId).orElseThrow();
        u.setPrivacySettings(in);
        u.setPrefsUpdatedAt(Instant.now());
        return u.getPrivacySettings();
    }

    // -------- Per-chat mute (user × chat) --------
    @Transactional
    public Instant setChatMute(Long userId, Long chatId, Instant mutedUntil) {
        if (mutedUntil == null) {
            ucpRepo.deleteByUserIdAndChatId(userId, chatId);
            return null;
        }

        UserChatPrefs p = ucpRepo.findByUserIdAndChatId(userId, chatId).orElseGet(() -> {
            UserChatPrefs x = new UserChatPrefs();
            x.setUserId(userId);
            x.setChatId(chatId);
            return x;
        });
        p.setMutedUntil(mutedUntil);
        ucpRepo.save(p);
        return mutedUntil;
    }

    @Transactional
    public void clearChatMute(Long userId, Long chatId) {
        ucpRepo.findByUserIdAndChatId(userId, chatId).ifPresent(pref -> {
            ucpRepo.delete(pref);
            ucpRepo.flush();
        });
    }

    // -------- Phone helpers (if you already exposed these in your controller) --------
    @Transactional(readOnly = true)
    public String getUserById(Long id) {
        return userRepo.findById(id).map(User::getUserName).orElse(null);
    }

    public User getUser(String phoneNumber) {
      User user = userRepo.findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return user;
    }


    @Transactional(readOnly = true)
    public ResponseEntity<List<Long>> getUserIdsByPhoneNumbers(List<String> phoneNumbers) {
        log.info("This is the requested phoneNumber: phoneNumber={}", phoneNumbers);
        return new ResponseEntity<>(userRepo.findIdsByPhoneNumbers(phoneNumbers), HttpStatus.OK);
   }


    @Transactional(readOnly = true)
    public ResponseEntity<Long> getUserIdByPhoneNumber(String phoneNumber) {
        log.info("This is the requested phoneNumber: phoneNumber={}", phoneNumber);
        return new ResponseEntity<>(userRepo.findUserIdByPhoneNumber(phoneNumber), HttpStatus.OK);
    }


    @Transactional(readOnly = true)
    public ResponseEntity<String> getPhoneNumberByUserID(Long id) {
        log.info("This is the requested userID: UserId={}", id);
        return  new ResponseEntity<>(userRepo.findPhoneNumberByuserID(id), HttpStatus.OK);
    }


    @Transactional(readOnly = true)
    public ResponseEntity<List<String>> getPhoneNumbersByIds(List<Long> id) {
        log.info("This is the requested userID: userID={}", id);
        return new ResponseEntity<>(userRepo.findPhoneNumbersByIds(id), HttpStatus.OK);
    }
    
    public UserProfileDto getUserProfileById(Long aLong) {
        return userRepo.findById(aLong).map(this::toUserProfileDto).orElse(null);
    }

    @Transactional
    public UserProfileDto updateDisplayName(Long userId, String displayName) {
        if (!StringUtils.hasText(displayName)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Display name must not be blank");
        }

        User user = userRepo.findById(userId).orElseThrow();
        user.setUserName(displayName.trim());
        user.setUpdatedAt(Instant.now());
        userRepo.save(user);
        return toUserProfileDto(user);
    }

    @Transactional(readOnly = true)
    public String getDisplayName(Long userId) {
        return userRepo.findById(userId).map(User::getUserName).orElse(null);
    }

    @Transactional(readOnly = true)
    public String getEmail(Long userId) {
        return userRepo.findById(userId).map(User::getEmail).orElse(null);
    }

    @Transactional
    public UserProfileDto updateEmail(Long userId, String email) {
        User user = userRepo.findById(userId).orElseThrow();
        if (!StringUtils.hasText(email)) {
            user.setEmail(null);
        } else {
            user.setEmail(email.trim());
        }
        user.setUpdatedAt(Instant.now());
        userRepo.save(user);
        return toUserProfileDto(user);
    }

    private UserProfileDto toUserProfileDto(User user) {
        UserProfileDto userprofile = new UserProfileDto();
        userprofile.setId(String.valueOf(user.getId()));
        userprofile.setAvatarUrl(user.getAvatarUrl());
        userprofile.setEmail(user.getEmail());
        userprofile.setDisplayName(user.getUserName());
        return userprofile;
    }
}

