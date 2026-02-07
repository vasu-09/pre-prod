package com.om.backend.Config;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;

/** Unauthenticated: principal=phone (String), credentials=otp (String)
 *  Authenticated:  principal=UserDetails, credentials=null
 */
public class OtpAuthenticationToken extends AbstractAuthenticationToken {
    private final Object principal;
    private Object credentials;

    // request (unauthenticated)
    public static OtpAuthenticationToken unauthenticated(String phone, String otp) {
        return new OtpAuthenticationToken(phone, otp, null);
    }

    // result (authenticated)
    public static OtpAuthenticationToken authenticated(UserDetails user, Collection<? extends GrantedAuthority> auths) {
        OtpAuthenticationToken t = new OtpAuthenticationToken(user, null, auths);
        t.setAuthenticated(true);
        return t;
    }

    private OtpAuthenticationToken(Object principal, Object credentials, Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.principal = principal;
        this.credentials = credentials;
    }

    @Override public Object getCredentials() { return credentials; }
    @Override public Object getPrincipal() { return principal; }

    @Override public void eraseCredentials() { super.eraseCredentials(); this.credentials = null; }
}