package com.om.backend.Dto;




public class AvatarCommitReq {
    private String key;
    private long size;
    private String sha256;

    public AvatarCommitReq() {}
    public AvatarCommitReq(String key, long size, String sha256) {
        this.key = key; this.size = size; this.sha256 = sha256;
    }
    public String getKey() { return key; }
    public long getSize() { return size; }
    public String getSha256() { return sha256; }
}
