package com.om.backend.Dto;


public class MediaGetUrlReq {
    private String bucket;
    private String key;
    private int ttlSeconds;

    public MediaGetUrlReq() {}
    public MediaGetUrlReq(String bucket, String key, int ttlSeconds) {
        this.bucket = bucket; this.key = key; this.ttlSeconds = ttlSeconds;
    }
    public String getBucket() { return bucket; }
    public String getKey() { return key; }
    public int getTtlSeconds() { return ttlSeconds; }
}
