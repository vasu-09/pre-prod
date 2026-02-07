package com.om.Real_Time_Communication.dto;

public class HeadReq {
    private String bucket;
    private String key;

    public HeadReq() {}
    public HeadReq(String bucket, String key) {
        this.bucket = bucket; this.key = key;
    }
    public String getBucket() { return bucket; }
    public String getKey() { return key; }
}
