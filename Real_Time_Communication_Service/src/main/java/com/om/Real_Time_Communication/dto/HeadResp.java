package com.om.Real_Time_Communication.dto;

public class HeadResp {
    private boolean exists;
    private long size;
    private String contentType;

    public HeadResp() {}
    public HeadResp(boolean exists, long size, String contentType) {
        this.exists = exists; this.size = size; this.contentType = contentType;
    }
    public boolean isExists() { return exists; }
    public long getSize() { return size; }
    public String getContentType() { return contentType; }
}