package com.om.Real_Time_Communication.service;

import com.google.cloud.storage.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URL;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;



@Service
public class GcsSigner {

    private final Storage storage;

    @Value("${media.bucket}")
    private String bucket;

    @Value("${media.uploadExpirySeconds:600}")
    private int uploadExpiry;

    @Value("${media.downloadExpirySeconds:300}")
    private int downloadExpiry;

    // Signed URLs are generated via ADC (Workload Identity supported) using V4 signatures.

    public GcsSigner(Storage storage) {
        this.storage = storage;
    }

    /** Backward-compatible: choose between single-shot PUT and resumable-init. */
    public URL signPutUrl(String objectName, String contentType, boolean resumable) {
        return resumable ? signResumableInitUrl(objectName, contentType)
                : signPutUrl(objectName, contentType);
    }

    /** Signed URL for a single-shot PUT (non-resumable). Client must send the same Content-Type. */
    public URL signPutUrl(String objectName, String contentType) {
        BlobInfo blob = BlobInfo.newBuilder(bucket, objectName).setContentType(contentType).build();
        return storage.signUrl(
                blob,
                uploadExpiry, TimeUnit.SECONDS,
                Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
                Storage.SignUrlOption.withV4Signature(),
                Storage.SignUrlOption.withContentType()
        );

    }

    /** Signed URL to INITIATE a resumable upload. Client must send header x-goog-resumable: start. */
    public URL signResumableInitUrl(String objectName, String contentType) {
        BlobInfo blob = BlobInfo.newBuilder(bucket, objectName).setContentType(contentType).build();
        return storage.signUrl(
                blob,
                uploadExpiry, TimeUnit.SECONDS,
                // GCS allows PUT or POST to initiate; PUT is common
                Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
                Storage.SignUrlOption.withV4Signature(),
                Storage.SignUrlOption.withContentType(),
                // This header must be part of the signature for resumable init
                Storage.SignUrlOption.withExtHeaders(Map.of("x-goog-resumable", "start"))
        );
    }

    /** Signed URL for GET (download/thumbnail/derivative). */
    public URL signGetUrl(String objectName) {
        BlobInfo blob = BlobInfo.newBuilder(bucket, objectName).build();
        return storage.signUrl(
                blob,
                downloadExpiry, TimeUnit.SECONDS,
                Storage.SignUrlOption.httpMethod(HttpMethod.GET),

                Storage.SignUrlOption.withV4Signature()
        );

    }

    public String signPutUrl(String bucket, String key, String contentType, Duration ttl) {
        URL url = storage.signUrl(
                BlobInfo.newBuilder(bucket, key).setContentType(contentType).build(),
                ttl.toSeconds(), TimeUnit.SECONDS,
                Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
                Storage.SignUrlOption.withV4Signature(),
                Storage.SignUrlOption.withContentType()
        );
        return url.toString();
    }

    public String signGetUrl(String bucket, String key, Duration ttl) {
        URL url = storage.signUrl(
                BlobInfo.newBuilder(bucket, key).build(),
                ttl.toSeconds(), TimeUnit.SECONDS,
                Storage.SignUrlOption.httpMethod(HttpMethod.GET),
                Storage.SignUrlOption.withV4Signature()
        );
        return url.toString();
    }

    // --- Overloads so you can pass ttlSeconds (no Duration in callers if you prefer)
    public String signPutUrl(String bucket, String key, String contentType, int ttlSeconds) {
        return signPutUrl(bucket, key, contentType, Duration.ofSeconds(ttlSeconds));
    }
    public String signGetUrl(String bucket, String key, int ttlSeconds) {
        return signGetUrl(bucket, key, Duration.ofSeconds(ttlSeconds));
    }

    // --- ✨ Add this: used by /internal/media/head to verify the object
    public ObjectMeta head(String bucket, String key) {
        Blob blob = storage.get(BlobId.of(bucket, key));
        if (blob == null) return new ObjectMeta(false, 0L, null);
        return new ObjectMeta(true, blob.getSize(), blob.getContentType());
    }

    // Tiny metadata holder to return to controller
    public static class ObjectMeta {
        private final boolean exists;
        private final long size;
        private final String contentType;
        public ObjectMeta(boolean exists, long size, String contentType) {
            this.exists = exists; this.size = size; this.contentType = contentType;
        }
        public boolean exists() { return exists; }
        public long size() { return size; }
        public String contentType() { return contentType; }
    }
}
