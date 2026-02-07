package com.om.backend.Dto;

import lombok.Data;

@Data
public class OneTimePreKeyDto {
    private int preKeyId;
    private String preKeyPublic;

    public int getPreKeyId() {
        return preKeyId;
    }

    public void setPreKeyId(int preKeyId) {
        this.preKeyId = preKeyId;
    }

    public String getPreKeyPublic() {
        return preKeyPublic;
    }

    public void setPreKeyPublic(String preKeyPublic) {
        this.preKeyPublic = preKeyPublic;
    }
}
