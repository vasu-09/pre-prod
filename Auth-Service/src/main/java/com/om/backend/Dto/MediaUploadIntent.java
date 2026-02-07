package com.om.backend.Dto;


public class MediaUploadIntent {
    private String bucket;
    private String key;
    private String contentType;
    private long size;
    private String sha256;
    private int ttlSeconds;

    public MediaUploadIntent() {}
    public MediaUploadIntent(String bucket, String key, String contentType, long size, String sha256, int ttlSeconds) {
        this.bucket = bucket; this.key = key; this.contentType = contentType;
        this.size = size; this.sha256 = sha256; this.ttlSeconds = ttlSeconds;
    }
    public String getBucket() { return bucket; }
    public String getKey() { return key; }
    public String getContentType() { return contentType; }
    public long getSize() { return size; }
    public String getSha256() { return sha256; }
    public int getTtlSeconds() { return ttlSeconds; }
}
