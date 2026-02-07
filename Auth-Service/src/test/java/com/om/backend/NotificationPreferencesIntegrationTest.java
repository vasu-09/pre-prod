package com.om.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.om.backend.Model.NotificationPreferences;
import com.om.backend.Model.User;
import com.om.backend.Repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content; // <-- missing before
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
// If CSRF is enabled in your SecurityConfig, also import and use:
// import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationPreferencesIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired UserRepository userRepo;

    private Long userId;
    private Instant before;

    @BeforeEach
    void setUp() {
        userRepo.deleteAll();
        User u = new User();
        u.setPhoneNumber("+10000000000");
        u.setActive(true);
        u = userRepo.save(u);
        userId = u.getId();
        before = u.getPrefsUpdatedAt();
    }

    /** Build a JWT that your security layer will accept, with subject = this test userId */
    private RequestPostProcessor userJwt() {
        return jwt()
            .jwt(j -> j
                .subject(userId.toString())                 // <-- important: tie JWT to created user
                .claim("scope", "notifications notifications:write")
            )
            .authorities(
                new SimpleGrantedAuthority("SCOPE_notifications"),
                new SimpleGrantedAuthority("SCOPE_notifications:write")
            );
    }

    @Test
    void roundTripNotificationPrefs() throws Exception {
        // 1) Update prefs
        NotificationPreferences prefs = new NotificationPreferences();
        prefs.previewPolicy = "hide";
        prefs.messages.enabled = false;

        mvc.perform(
                put("/user/me/preferences/notifications")
                    .with(userJwt())
                    // .with(csrf()) // ONLY if you enabled CSRF for APIs
                    .contentType(APPLICATION_JSON)
                    .content(om.writeValueAsString(prefs))
            )
            .andExpect(status().isOk());

        // 2) Read back prefs
        String body = mvc.perform(
                get("/user/me/preferences/notifications")
                    .with(userJwt())
            )
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        NotificationPreferences out = om.readValue(body, NotificationPreferences.class);
        assertThat(out.previewPolicy).isEqualTo("hide");
        assertThat(out.messages.enabled).isFalse();

        // 3) Verify persisted state
        User updated = userRepo.findById(userId).orElseThrow();
        assertThat(updated.getNotificationPrefs().previewPolicy).isEqualTo("hide");
        assertThat(updated.getPrefsUpdatedAt()).isAfter(before);
    }
}
