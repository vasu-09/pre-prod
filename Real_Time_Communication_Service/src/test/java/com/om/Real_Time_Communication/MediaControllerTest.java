package com.om.Real_Time_Communication;

import com.om.Real_Time_Communication.Repository.MediaRepository;
import com.om.Real_Time_Communication.controller.MediaController;
import com.om.Real_Time_Communication.models.Media;
import com.om.Real_Time_Communication.service.GcsSigner;
import com.om.Real_Time_Communication.service.MediaJobs;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MediaControllerTest {

    @Mock
    MediaRepository repo;
    @Mock
    GcsSigner signer;
    @Mock
    MediaJobs jobs;

    @Test
    void retryRequeuesJobOnFailedMedia() {
        Media m = new Media();
        m.setId(1L);
        m.setOwnerUserId(42L);
        m.setStatus("FAILED");
        m.setUpdatedAt(Instant.now());
        when(repo.findById(1L)).thenReturn(Optional.of(m));
        when(repo.save(any(Media.class))).thenAnswer(inv -> inv.getArgument(0));

        MediaController controller = new MediaController(repo, signer, jobs);
        Principal p = () -> "42";

        Map<String,Object> resp = controller.retry(1L, p);

        assertEquals(true, resp.get("ok"));
        assertEquals("UPLOADED", m.getStatus());
        verify(jobs).enqueueProcess(1L);
    }
}
