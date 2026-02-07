package com.om.Real_Time_Communication.controller;

import com.om.Real_Time_Communication.Repository.MediaRepository;
import com.om.Real_Time_Communication.dto.*;
import com.om.Real_Time_Communication.models.Media;
import org.springframework.http.HttpStatus;
import com.om.Real_Time_Communication.service.GcsSigner;
import com.om.Real_Time_Communication.service.MediaJobs;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URL;
import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

// MediaController.java
@RestController
@RequestMapping("/api/media")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class MediaController {
    private final MediaRepository repo;
    private final GcsSigner signer;
    private final MediaJobs jobs;

    private static final long MAX_SIZE_BYTES = 50L * 1024 * 1024; // 50MB
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "video/mp4"
    );

    public MediaController(MediaRepository repo, GcsSigner signer, MediaJobs jobs) {
        this.repo = repo; this.signer = signer; this.jobs = jobs;
    }


    @PostMapping("/upload-intent")
    public UploadIntentResp upload(@RequestBody UploadIntentReq r) {
        String put = signer.signPutUrl(r.getBucket(), r.getKey(), r.getContentType(), Duration.ofMinutes(10));
        return new UploadIntentResp(put, Instant.now().plusSeconds(600));
    }

    @PostMapping("/get-url")
    public GetUrlResp get(@RequestBody GetUrlReq r) {
        String url = signer.signGetUrl(r.getBucket(), r.getKey(), Duration.ofMinutes(10));
        return new GetUrlResp(url, Instant.now().plusSeconds(600));
    }

    @PostMapping("/head")
    public HeadResp head(@RequestBody HeadReq r) {
        // Implement using Storage API HEAD/GET metadata
        var meta = signer.head(r.getBucket(), r.getKey());
        return new HeadResp(meta.exists(), meta.size(), meta.contentType());
    }
    // 1) Client requests an upload slot
    @PostMapping("/uploads")
    public Map<String,Object> createUpload(Principal principal,
                                           @RequestBody CreateUploadReq req) {
        Long userId = Long.valueOf(principal.getName());

        // Validate
        if (req.contentType() == null || !ALLOWED_CONTENT_TYPES.contains(req.contentType())) {
            throw new IllegalArgumentException("unsupported content type");
        }
        if (req.sizeBytes() == null || req.sizeBytes() > MAX_SIZE_BYTES) {
            throw new IllegalArgumentException("file too large");
        }
        // TODO: hook in an antivirus/unsafe content scanner here

        String ulid = java.util.UUID.randomUUID().toString().replace("-", "");
        String object = "uploads/%s/%s/%s-orig".formatted(
                java.time.LocalDate.now(), userId, ulid);

        Media m = new Media();
        m.setOwnerUserId(userId);
        m.setContentType(req.contentType());
        m.setSizeBytes(req.sizeBytes());
        m.setGcsBucket(System.getenv("MEDIA_BUCKET"));
        m.setGcsObject(object);
        m.setStatus("CREATED");
        m.setCreatedAt(Instant.now()); m.setUpdatedAt(Instant.now());
        repo.save(m);

        try {
            URL putUrl = signer.signPutUrl(object, req.contentType(), req.resumable());
            return Map.of(
                    "mediaId", m.getId(),
                    "putUrl", putUrl.toString(),
                    "resumable", req.resumable(),
                    "headers", Map.of(
                            // client MUST set this header to initiate resumable
                            "x-goog-resumable", req.resumable() ? "start" : null
                    )
            );
        } catch (RuntimeException e) {
            m.setStatus("FAILED");
            m.setUpdatedAt(Instant.now());
            repo.save(m);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to generate signed upload URL", e);
        }
    }

    // 2) Client tells us upload is complete (or use a GCS notification to automate)
    @PostMapping("/{mediaId}/complete")
    public Map<String,Object> complete(@PathVariable Long mediaId, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        Media m = repo.findById(mediaId).orElseThrow();
        if (!m.getOwnerUserId().equals(userId)) throw new IllegalArgumentException("forbidden");
        if (!"CREATED".equals(m.getStatus()) && !"UPLOADING".equals(m.getStatus()))
            return Map.of("ok", true); // idempotent

        m.setStatus("UPLOADED");
        m.setUpdatedAt(Instant.now());
        repo.save(m);

        // Enqueue processing job (thumb/transcode)
        jobs.enqueueProcess(mediaId);
        return Map.of("ok", true);
    }

    // 3) Client asks for view URLs (short-lived signed GETs)
    @GetMapping("/{mediaId}/urls")
    public Map<String,Object> urls(@PathVariable Long mediaId, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        Media m = repo.findById(mediaId).orElseThrow();
        // Access policy: check room membership if you bind media to a room
        // if (!canView(userId, m)) throw new IllegalArgumentException("forbidden");

        try {
            Map<String,Object> out = new LinkedHashMap<>();
            out.put("original", signer.signGetUrl(m.getGcsObject()).toString());
            if (m.getThumbObject() != null) out.put("thumb", signer.signGetUrl(m.getThumbObject()).toString());
            if (m.getTranscodeObject() != null) out.put("transcode", signer.signGetUrl(m.getTranscodeObject()).toString());
            out.put("contentType", m.getContentType());
            out.put("status", m.getStatus());
            out.put("width", m.getWidth());
            out.put("height", m.getHeight());
            out.put("durationMs", m.getDurationMs());
            return out;
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to generate signed download URL", e);
        }
    }

    // Manual retry if processing failed
    @PostMapping("/{mediaId}/retry")
    public Map<String,Object> retry(@PathVariable Long mediaId, Principal principal) {
        Long userId = Long.valueOf(principal.getName());
        Media m = repo.findById(mediaId).orElseThrow();
        if (!m.getOwnerUserId().equals(userId)) throw new IllegalArgumentException("forbidden");
        if (!"FAILED".equals(m.getStatus())) return Map.of("ok", false);
        m.setStatus("UPLOADED");
        m.setUpdatedAt(Instant.now());
        repo.save(m);
        jobs.enqueueProcess(mediaId);
        return Map.of("ok", true);
    }

    public record CreateUploadReq(String contentType, Long sizeBytes, boolean resumable) {}
}

