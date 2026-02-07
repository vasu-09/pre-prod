package com.om.backend.services;

import com.om.backend.Model.User;
import com.om.backend.Repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class MyUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;


    @Override
    public UserDetails loadUserByUsername(String phonenumber) throws UsernameNotFoundException {
        User user = userRepository.findByPhoneNumber(phonenumber).get();
        if(user==null){
            throw  new UsernameNotFoundException("User not found with phone number: "+ phonenumber);
        }
        return new CustomUserDetails(user);
    }
}
