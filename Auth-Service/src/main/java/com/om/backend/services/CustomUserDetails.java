package com.om.backend.services;

import com.om.backend.Model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;

public class CustomUserDetails implements UserDetails {

    private User user;
    public CustomUserDetails(User user) {
        this.user= user;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.emptyList(); // No roles for now
    }

    public Long getId(){return user.getId();}

    @Override
    public String getPassword() {
        return null; // We don’t use passwords
    }

    @Override
    public String getUsername() {
        return user.getPhoneNumber(); // Using phone number as the username
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return user.isActive(); // Only allow active users
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.isActive();
    }

    public User getUser() {
        return user;
    }
}
