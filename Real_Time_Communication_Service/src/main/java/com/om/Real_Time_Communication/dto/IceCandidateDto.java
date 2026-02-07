package com.om.Real_Time_Communication.dto;

public class IceCandidateDto {
    private String candidate;
    private boolean e2ee;
    private Short e2eeVer;
    private String algo;
    private byte[] aad;
    private byte[] iv;
    private byte[] ciphertext;
    private String keyRef;

    public String getCandidate() {
        return candidate;
    }

    public void setCandidate(String candidate) {
        this.candidate = candidate;
    }

    public boolean isE2ee() {
        return e2ee;
    }

    public void setE2ee(boolean e2ee) {
        this.e2ee = e2ee;
    }

    public Short getE2eeVer() {
        return e2eeVer;
    }

    public void setE2eeVer(Short e2eeVer) {
        this.e2eeVer = e2eeVer;
    }

    public String getAlgo() {
        return algo;
    }

    public void setAlgo(String algo) {
        this.algo = algo;
    }

    public byte[] getAad() {
        return aad;
    }

    public void setAad(byte[] aad) {
        this.aad = aad;
    }

    public byte[] getIv() {
        return iv;
    }

    public void setIv(byte[] iv) {
        this.iv = iv;
    }

    public byte[] getCiphertext() {
        return ciphertext;
    }

    public void setCiphertext(byte[] ciphertext) {
        this.ciphertext = ciphertext;
    }

    public String getKeyRef() {
        return keyRef;
    }

    public void setKeyRef(String keyRef) {
        this.keyRef = keyRef;
    }
}
