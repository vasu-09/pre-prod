package com.om.Real_Time_Communication;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageException;
import com.om.Real_Time_Communication.Repository.MediaRepository;
import com.om.Real_Time_Communication.models.Media;
import com.om.Real_Time_Communication.utility.MediaWorker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MediaWorkerTest {

    @Mock
    MediaRepository repo;
    @Mock
    Storage storage;

    MediaWorker worker;

    @BeforeEach
    void setup() {
        worker = new MediaWorker(repo, storage);
        ReflectionTestUtils.setField(worker, "bucket", "bucket");
    }

    @Test
    void retriesUploadOnTransientError() throws Exception {
        Media m = new Media();
        m.setId(1L);
        m.setContentType("image/jpeg");
        m.setGcsObject("uploads/obj");
        when(repo.findById(1L)).thenReturn(Optional.of(m));
        when(repo.save(any(Media.class))).thenAnswer(inv -> inv.getArgument(0));

        byte[] img = dummyImage();
        Blob orig = mock(Blob.class);
        when(orig.getContent()).thenReturn(img);
        when(storage.get(any(BlobId.class))).thenReturn(orig);

        when(storage.create(any(BlobInfo.class), any(byte[].class)))
                .thenThrow(new StorageException(500, "boom"))
                .thenReturn(null);

        worker.onProcess(Map.of("mediaId", 1L));

        assertEquals("READY", m.getStatus());
        verify(storage, times(2)).create(any(BlobInfo.class), any(byte[].class));
    }

    @Test
    void marksFailedAfterPermanentError() throws Exception {
        Media m = new Media();
        m.setId(1L);
        m.setContentType("image/jpeg");
        m.setGcsObject("uploads/obj");
        when(repo.findById(1L)).thenReturn(Optional.of(m));
        when(repo.save(any(Media.class))).thenAnswer(inv -> inv.getArgument(0));

        byte[] img = dummyImage();
        Blob orig = mock(Blob.class);
        when(orig.getContent()).thenReturn(img);
        when(storage.get(any(BlobId.class))).thenReturn(orig);

        when(storage.create(any(BlobInfo.class), any(byte[].class)))
                .thenThrow(new StorageException(500, "boom"));

        worker.onProcess(Map.of("mediaId", 1L));

        assertEquals("FAILED", m.getStatus());
        verify(storage, times(3)).create(any(BlobInfo.class), any(byte[].class));
    }

    private byte[] dummyImage() throws IOException {
        BufferedImage img = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "jpg", out);
        return out.toByteArray();
    }
}