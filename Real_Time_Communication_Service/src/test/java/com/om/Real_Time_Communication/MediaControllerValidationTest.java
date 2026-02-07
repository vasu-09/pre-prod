package com.om.Real_Time_Communication;

import com.om.Real_Time_Communication.Repository.MediaRepository;
import com.om.Real_Time_Communication.controller.MediaController;
import com.om.Real_Time_Communication.service.GcsSigner;
import com.om.Real_Time_Communication.service.MediaJobs;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.security.Principal;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class MediaControllerValidationTest {
    MediaRepository repo;
    GcsSigner signer;
    MediaJobs jobs;
    MediaController controller;
    Principal principal;

    @BeforeEach
    void setup() {
        repo = mock(MediaRepository.class);
        signer = mock(GcsSigner.class);
        jobs = mock(MediaJobs.class);
        controller = new MediaController(repo, signer, jobs);
        principal = () -> "1";
    }

    @Test
    void rejectsLargeFiles() {
        MediaController.CreateUploadReq req = new MediaController.CreateUploadReq("image/jpeg", 60L * 1024 * 1024, false);
        assertThrows(IllegalArgumentException.class, () -> controller.createUpload(principal, req));
    }

    @Test
    void rejectsUnknownMime() {
        MediaController.CreateUploadReq req = new MediaController.CreateUploadReq("application/zip", 1024L, false);
        assertThrows(IllegalArgumentException.class, () -> controller.createUpload(principal, req));
    }
}