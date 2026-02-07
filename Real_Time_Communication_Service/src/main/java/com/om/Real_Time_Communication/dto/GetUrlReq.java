package com.om.Real_Time_Communication.dto;

public class GetUrlReq {
    private String bucket;
    private String key;
    private int ttlSeconds;

    public GetUrlReq() {}
    public GetUrlReq(String bucket, String key, int ttlSeconds) {
        this.bucket = bucket; this.key = key; this.ttlSeconds = ttlSeconds;
    }
    public String getBucket() { return bucket; }
    public String getKey() { return key; }
    public int getTtlSeconds() { return ttlSeconds; }
}
