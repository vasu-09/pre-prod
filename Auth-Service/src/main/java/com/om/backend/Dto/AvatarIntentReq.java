package com.om.backend.Dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


@Getter
@Setter

public class AvatarIntentReq {
    private String contentType;
    private long size;
    private String sha256; // optional

    public AvatarIntentReq() {}
    public AvatarIntentReq(String contentType, long size, String sha256) {
        this.contentType = contentType; this.size = size; this.sha256 = sha256;
    }
    public String getContentType() { return contentType; }
    public long getSize() { return size; }
    public String getSha256() { return sha256; }
}
