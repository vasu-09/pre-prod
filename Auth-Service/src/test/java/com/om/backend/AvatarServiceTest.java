package com.om.backend;

import com.om.backend.Dto.*;
import com.om.backend.Model.User;
import com.om.backend.Repositories.UserRepository;
import com.om.backend.client.MediaClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import com.om.backend.services.AvatarService;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class AvatarServiceTest {
    private UserRepository userRepo;
    private MediaClient mediaClient;
    private AvatarService avatarService;
    private final String bucket = "test-bucket";

    @BeforeEach
    void setUp() {
        userRepo = mock(UserRepository.class);
        mediaClient = mock(MediaClient.class);
        avatarService = new AvatarService(userRepo, mediaClient);
        ReflectionTestUtils.setField(avatarService, "bucket", bucket);
    }

    @Test
    void commitStoresPointerAndDoesNotTouchLifecycle() {
        Long userId = 7L;
        User user = new User();
        user.setId(userId);
        user.setAvatarKey("avatars/7/v1/old.jpg");

        when(userRepo.findById(userId)).thenReturn(Optional.of(user));
        when(mediaClient.head(any(MediaHeadReq.class)))
                .thenReturn(new MediaHeadResp(true, 123L, "image/jpeg"));
        when(userRepo.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        String newKey = "avatars/7/v2/new.jpg";
        AvatarCommitReq req = new AvatarCommitReq(newKey, 123L, "sha256");

        User updated = avatarService.commit(userId, req);

        assertEquals(newKey, updated.getAvatarKey());
        assertNotNull(updated.getAvatarUpdatedAt());

        ArgumentCaptor<MediaHeadReq> headReq = ArgumentCaptor.forClass(MediaHeadReq.class);
        verify(mediaClient).head(headReq.capture());
        assertEquals(bucket, headReq.getValue().getBucket());
        assertEquals(newKey, headReq.getValue().getKey());
        verifyNoMoreInteractions(mediaClient);

        verify(userRepo).findById(userId);
        verify(userRepo).save(user);
        verifyNoMoreInteractions(userRepo);
    }

    @Test
    void createIntentReturnsSignedUrl() {
        Long userId = 5L;
        User user = new User();
        user.setId(userId);
        when(userRepo.findById(userId)).thenReturn(Optional.of(user));

        MediaUploadIntentResp signed = new MediaUploadIntentResp("http://put", Instant.now().plusSeconds(600));
        when(mediaClient.uploadIntent(any(MediaUploadIntent.class))).thenReturn(signed);

        AvatarIntentReq req = new AvatarIntentReq("image/png", 1000L, "hash");
        AvatarIntentResp resp = avatarService.createIntent(userId, req);

        assertNotNull(resp.getKey());
        assertTrue(resp.getKey().startsWith("avatars/" + userId + "/v1/"));
        assertEquals("http://put", resp.getPutUrl());
        assertEquals(signed.getExpiresAt(), resp.getExpiresAt());
        assertEquals(Long.valueOf(5L * 1024 * 1024), resp.getMaxSize());

        ArgumentCaptor<MediaUploadIntent> captor = ArgumentCaptor.forClass(MediaUploadIntent.class);
        verify(mediaClient).uploadIntent(captor.capture());
        assertEquals(bucket, captor.getValue().getBucket());
        assertEquals(resp.getKey(), captor.getValue().getKey());
        assertEquals("image/png", captor.getValue().getContentType());
        assertEquals(1000L, captor.getValue().getSize());
        verifyNoMoreInteractions(mediaClient);

        verify(userRepo).findById(userId);
        verifyNoMoreInteractions(userRepo);
    }
}

