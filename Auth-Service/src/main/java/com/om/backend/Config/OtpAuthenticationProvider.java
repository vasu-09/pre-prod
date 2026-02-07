package com.om.backend.Config;



import com.om.backend.Model.User;
import com.om.backend.services.CustomUserDetails;
import com.om.backend.services.MyUserDetailsService;
import com.om.backend.services.OtpService;
import com.om.backend.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;

/** Delegates OTP validation to OtpService; loads/creates user via UserService. */
@Component
@RequiredArgsConstructor
public class OtpAuthenticationProvider implements AuthenticationProvider {

    private final OtpService otpService;
    private final UserService userService;
    private final MyUserDetailsService myUserDetailsService;

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        if (!(authentication instanceof OtpAuthenticationToken token)) return null;

        String phone = (String) token.getPrincipal();
        String otp   = (String) token.getCredentials();

        try{
            otpService.verifyOtp(phone, otp); // ensures user exists
        } catch (IllegalArgumentException ex) {
            throw new BadOtpException("Invalid or expired OTP");
        }

        // Load the user via UserDetailsService (user was created by OtpService if absent)
        CustomUserDetails user = (CustomUserDetails) myUserDetailsService.loadUserByUsername(phone);

        var result = OtpAuthenticationToken.authenticated(user, user.getAuthorities());
        result.setDetails(authentication.getDetails());
        return result;
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return OtpAuthenticationToken.class.isAssignableFrom(authentication);
    }

    public static class BadOtpException extends org.springframework.security.core.AuthenticationException {
        public BadOtpException(String msg) { super(msg); }
    }


}
