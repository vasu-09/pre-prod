package com.om.Real_Time_Communication.utility;

import com.google.cloud.storage.*;

import com.om.Real_Time_Communication.Repository.MediaRepository;
import com.om.Real_Time_Communication.models.Media;

import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;
import org.springframework.transaction.annotation.Transactional;
import com.om.Real_Time_Communication.config.MediaQueueConfig;
import com.google.cloud.storage.StorageException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;

@Component
@Profile("!test")

public class MediaWorker {

    private final MediaRepository repo;
    private final Storage storage;   // GCS client

    public MediaWorker(MediaRepository repo, Storage storage) {
        this.repo = repo;
        this.storage = storage;

    }

    @Value("${media.bucket}") private String bucket;

    @RabbitListener(queues = MediaQueueConfig.QUEUE_PROCESS)
    @Transactional
    public void onProcess(Map<String,Object> msg)  {
        Long mediaId = ((Number) msg.get("mediaId")).longValue();
        Media m = repo.findById(mediaId).orElseThrow();

        m.setStatus("PROCESSING");
        m.setUpdatedAt(Instant.now());
        repo.save(m);
        try {
            Blob orig = storage.get(BlobId.of(bucket, m.getGcsObject()));
            if (orig == null) throw new IllegalStateException("Original not found: " + m.getGcsObject());
            byte[] origBytes = orig.getContent();

            if (m.getContentType() != null && m.getContentType().startsWith("image/")) {
                // thumbnail (320w) as JPEG
                String thumbObj = m.getGcsObject().replace("/uploads/", "/thumbs/") + "-320.jpg";
                byte[] thumb = ImageIOUtils.downscaleJpeg(origBytes, 320);
                createWithRetry(BlobInfo.newBuilder(bucket, thumbObj)
                        .setContentType("image/jpeg").build(), thumb);

                m.setThumbObject(thumbObj);

            // width/height
                ImageIOUtils.Size sz = ImageIOUtils.detectSize(origBytes);
                m.setWidth(sz.width());
                m.setHeight(sz.height());
            }
            else if (m.getContentType() != null && m.getContentType().startsWith("video/")) {
                String base = m.getGcsObject().replace("/uploads/", "/video/");
                String mp4Obj = base + "-720.mp4";
                String posterObj = base + "-poster.jpg";

                // temp files
                Path tmpIn = Files.createTempFile("moc-in-", ".bin");
                Path outMp4 = Files.createTempFile("moc-out-", ".mp4");
                Path outJpg = Files.createTempFile("moc-out-", ".jpg");
                try {
                    Files.write(tmpIn, origBytes);

                    FfmpegRunner.transcode720p(tmpIn, outMp4);
                    FfmpegRunner.extractPoster(tmpIn, outJpg);

                    createWithRetry(BlobInfo.newBuilder(bucket, mp4Obj)
                            .setContentType("video/mp4").build(), Files.readAllBytes(outMp4));
                    createWithRetry(BlobInfo.newBuilder(bucket, posterObj)
                            .setContentType("image/jpeg").build(), Files.readAllBytes(outJpg));

                    m.setTranscodeObject(mp4Obj);
                    m.setThumbObject(posterObj);

                    FfmpegRunner.VideoMeta meta = FfmpegRunner.probe(outMp4);
                    m.setDurationMs(meta.durationMs());
                    m.setWidth(meta.width());
                    m.setHeight(meta.height());
                } finally {
                    Files.deleteIfExists(tmpIn);
                    Files.deleteIfExists(outMp4);
                    Files.deleteIfExists(outJpg);
                }
            }

            m.setStatus("READY");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            m.setStatus("FAILED");
        } catch (Exception e) {
            m.setStatus("FAILED");
        } finally {
            m.setUpdatedAt(Instant.now());
            repo.save(m);
        }

    }

    private void createWithRetry(BlobInfo info, byte[] content) throws InterruptedException {
        int attempts = 0;
        while (true) {

            try {
                storage.create(info, content);
                return;
            } catch (StorageException ex) {
                attempts++;
                if (ex.getCode() >0 && ex.getCode() < 500 || attempts >= 3) {
                    throw ex;
                }
                Thread.sleep(200);
            }
        }
    }
}