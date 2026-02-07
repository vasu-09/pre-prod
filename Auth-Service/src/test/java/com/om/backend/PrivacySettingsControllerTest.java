package com.om.backend;

import com.om.backend.Model.User;
import com.om.backend.Repositories.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import com.om.backend.client.MediaClient;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.Instant;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PrivacySettingsControllerTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    UserRepository userRepo;

     @MockBean
    MediaClient mediaClient;

    @Test
    void roundTripPrivacySettings() throws Exception {
        User u = new User();
        u.setPhoneNumber("123");
        u.setCreatedAt(Instant.now());
        u.setActive(true);
        userRepo.save(u);

        String body = """
            {
              \"readReceipts\": false,
              \"typingIndicators\": false,
              \"lastSeenVisibility\": \"nobody\",
              \"profilePhotoVisibility\": \"everyone\",
              \"onlineStatusVisibility\": \"nobody\"
            }
            """;

        String uid = u.getId().toString();

        mvc.perform(put("/user/me/privacy")
                        .with(user(uid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(content().json(body));

        mvc.perform(get("/user/me/privacy").with(user(uid)))
                .andExpect(status().isOk())
                .andExpect(content().json(body));
    }
}
