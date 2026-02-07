package com.om.backend;

import com.om.backend.Model.NotificationPreferences;
import com.om.backend.Model.PrivacySettings;
import com.om.backend.Model.User;
import com.om.backend.Repositories.UserChatPrefsRepository;
import com.om.backend.Repositories.UserRepository;
import com.om.backend.services.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class UserServiceTest {

    @Autowired
    UserRepository userRepo;
    @Autowired
    UserChatPrefsRepository prefsRepo;

    UserService userService;
    User user;

    @BeforeEach
    void setup(){
        userService = new UserService(userRepo, prefsRepo);
        user = new User();
        user.setPhoneNumber("+919999999999");
        user = userRepo.save(user);
    }

    @Test
    void preferencesGetPut() {
        NotificationPreferences p = new NotificationPreferences();
        p.messages.enabled = false;
        userService.updateNotificationPreferences(user.getId(), p);
        NotificationPreferences out = userService.getNotificationPreferences(user.getId());
        assertFalse(out.messages.enabled);
        assertFalse(userRepo.findById(user.getId()).orElseThrow().getNotificationPrefs().messages.enabled);
    }

    @Test
    void privacyGetPut() {
        PrivacySettings ps = new PrivacySettings();
        ps.readReceipts = false;
        userService.updatePrivacy(user.getId(), ps);
        PrivacySettings out = userService.getPrivacy(user.getId());
        assertFalse(out.readReceipts);
        assertFalse(userRepo.findById(user.getId()).orElseThrow().getPrivacySettings().readReceipts);
    }

    @Test
    void muteSetClear() {
        Instant until = Instant.now().plusSeconds(3600);
        userService.setChatMute(user.getId(), 123L, until);
        assertEquals(until, prefsRepo.findByUserIdAndChatId(user.getId(),123L).orElseThrow().getMutedUntil());
        userService.clearChatMute(user.getId(),123L);
        assertTrue(prefsRepo.findByUserIdAndChatId(user.getId(),123L).isEmpty());
    }
}

