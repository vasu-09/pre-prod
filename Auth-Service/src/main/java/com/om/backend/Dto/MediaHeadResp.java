package com.om.backend.Dto;


public class MediaHeadResp {
    private boolean exists;
    private long size;
    private String contentType;

    public MediaHeadResp() {}
    public MediaHeadResp(boolean exists, long size, String contentType) {
        this.exists = exists; this.size = size; this.contentType = contentType;
    }
    public boolean isExists() { return exists; }
    public long getSize() { return size; }
    public String getContentType() { return contentType; }
}