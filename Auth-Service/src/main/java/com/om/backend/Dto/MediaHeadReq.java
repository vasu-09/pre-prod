package com.om.backend.Dto;

public class MediaHeadReq {
    private String bucket;
    private String key;

    public MediaHeadReq() {}
    public MediaHeadReq(String bucket, String key) {
        this.bucket = bucket; this.key = key;
    }
    public String getBucket() { return bucket; }
    public String getKey() { return key; }
}