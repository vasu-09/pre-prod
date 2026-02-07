package com.om.backend.Config;

import lombok.Getter; import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix="jwt")
@Getter @Setter
public class JwtConfig {
    private String alg;              // "RS256"
    private String issuer;
    private String kid;              // current key id
    private String privateKeyPem;    // PKCS#8 private key PEM

    // optional rotation
    private String previousKid;
    private String previousPublicPem; // X.509 PUBLIC KEY PEM (-----BEGIN PUBLIC KEY-----)

    private long accessTtlMin;          // e.g., 15
    private long refreshTtlDays;
    private String audience;            // expected aud claim

    public String getAlg() {
        return alg;
    }

    public void setAlg(String alg) {
        this.alg = alg;
    }

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public String getKid() {
        return kid;
    }

    public void setKid(String kid) {
        this.kid = kid;
    }

    public String getPrivateKeyPem() {
        return privateKeyPem;
    }

    public void setPrivateKeyPem(String privateKeyPem) {
        this.privateKeyPem = privateKeyPem;
    }

    public String getPreviousKid() {
        return previousKid;
    }

    public void setPreviousKid(String previousKid) {
        this.previousKid = previousKid;
    }

    public String getPreviousPublicPem() {
        return previousPublicPem;
    }

    public void setPreviousPublicPem(String previousPublicPem) {
        this.previousPublicPem = previousPublicPem;
    }

    public long getAccessTtlMin() {
        return accessTtlMin;
    }

    public void setAccessTtlMin(long accessTtlMin) {
        this.accessTtlMin = accessTtlMin;
    }

    public long getRefreshTtlDays() {
        return refreshTtlDays;
    }

    public void setRefreshTtlDays(long refreshTtlDays) {
        this.refreshTtlDays = refreshTtlDays;
    }

    public String getAudience() {
        return audience;
    }

    public void setAudience(String audience) {
        this.audience = audience;
    }
}


