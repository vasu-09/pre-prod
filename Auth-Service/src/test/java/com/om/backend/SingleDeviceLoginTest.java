package com.om.backend;

import com.om.backend.Model.User;
import com.om.backend.Repositories.UserRepository;
import com.om.backend.Repositories.UserSessionRepository;
import com.om.backend.services.UserSessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import static org.junit.jupiter.api.Assertions.*;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@Import(UserSessionService.class)
@ActiveProfiles("test")
class SingleDeviceLoginTest {

    @Autowired
    UserSessionService sessionService;

    @Autowired
    UserRepository userRepo;

    @Autowired
    UserSessionRepository sessionRepo;

    private Long userId;

    @BeforeEach
    void setup() {
        User u = new User();
        u.setPhoneNumber("+1111111111");
        u.setActive(true);
        u = userRepo.save(u);
        userId = u.getId();
    }

    @Test
    void secondLoginRevokesPreviousSession() {
        sessionService.createOrUpdateSession(userId, "s1", null, null, null);
        sessionService.createOrUpdateSession(userId, "s2", null, null, null);

        assertNotNull(sessionRepo.findById("s1").orElseThrow().getRevokedAt());
        assertNull(sessionRepo.findById("s2").orElseThrow().getRevokedAt());
    }
}
