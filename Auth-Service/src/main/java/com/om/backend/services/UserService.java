//package com.om.backend.services;
//
//import com.om.backend.Dto.UserDTo;
//import com.om.backend.Model.NotificationPreferences;
//import com.om.backend.Model.PrivacySettings;
//import com.om.backend.Model.User;
//import com.om.backend.Model.UserChatPrefs;
//import com.om.backend.Repositories.UserChatPrefsRepository;
//import com.om.backend.Repositories.UserRepository;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.http.HttpStatus;
//import org.springframework.http.ResponseEntity;
//import org.springframework.security.authentication.AuthenticationManager;
//import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
//import org.springframework.security.core.Authentication;
//import org.springframework.security.core.userdetails.UsernameNotFoundException;
//import org.springframework.stereotype.Service;
//import org.springframework.transaction.annotation.Transactional;
//
//import java.time.Instant;
//import java.time.LocalDateTime;
//import java.util.List;
//import java.util.Map;
//
//@Service
//public class UserService {
//    @Autowired
//    private UserRepository userRepository;
//    @Autowired
//    private AuthenticationManager authenticationManager;
//    @Autowired
//    private JWTService jwtService;
//    @Autowired
//    private UserSessionService userSessionService;
//
//    @Autowired
//    private UserChatPrefsRepository ucpRepo;
//
//    @Transactional(readOnly = true)
//    public NotificationPreferences getNotificationPreferences(Long userId) {
//        return userRepository.findById(userId).orElseThrow().getNotificationPrefs();
//    }
//
//    @Transactional
//    public NotificationPreferences updateNotificationPreferences(Long userId, NotificationPreferences in) {
//        var u = userRepository.findById(userId).orElseThrow();
//        u.setNotificationPrefs(in);
//        u.setPrefsUpdatedAt(Instant.now());
//        return u.getNotificationPrefs();
//    }
//
//    @Transactional(readOnly = true)
//    public PrivacySettings getPrivacy(Long userId) {
//        return userRepository.findById(userId).orElseThrow().getPrivacySettings();
//    }
//
//    @Transactional
//    public PrivacySettings updatePrivacy(Long userId, PrivacySettings in) {
//        var u = userRepository.findById(userId).orElseThrow();
//        u.setPrivacySettings(in);
//        u.setPrefsUpdatedAt(Instant.now());
//        return u.getPrivacySettings();
//    }
//
//    // per-chat mute
//    @Transactional
//    public Instant setChatMute(Long userId, Long chatId, Instant mutedUntil) {
//        var pref = ucpRepo.findByUserIdAndChatId(userId, chatId).orElseGet(() -> {
//            var x = new UserChatPrefs();
//            x.setUserId(userId); x.setChatId(chatId);
//            return x;
//        });
//        pref.setMutedUntil(mutedUntil);
//        ucpRepo.save(pref);
//        return mutedUntil;
//    }
//
//    @Transactional
//    public void clearChatMute(Long userId, Long chatId) {
//        ucpRepo.deleteByUserIdAndChatId(userId, chatId);
//    }
//
//    public Map<String, String> login(UserDTo userDTo) {
//        Authentication authentication = authenticationManager.authenticate(
//                new UsernamePasswordAuthenticationToken(userDTo.getPhoneNumber(), userDTo.getOtpCode())
//        );
//
//        CustomUserDetails user = (CustomUserDetails) authentication.getPrincipal();
//        String phoneNumber = user.getUsername();
//
//        String accessToken = jwtService.generateToken(user);
//        String refreshToken = jwtService.generateRefreshToken(user);
//
//        User user1 = getUser(phoneNumber);
//
//        // You can store the refreshToken in DB via UserSessionService
//        userSessionService.createOrUpdateSession(phoneNumber,  refreshToken, user1);
//
//        return Map.of("accessToken", accessToken, "refreshToken", refreshToken);
//    }
//
//    public User getUser(String phoneNumber) {
//       User user = userRepository.findByPhoneNumber(phoneNumber)
//                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
//
//        return user;
//    }
//
//    public ResponseEntity<List<Long>> getUserIdsByPhoneNumbers(List<String> phoneNumbers) {
//        return new ResponseEntity<>(userRepository.findIdsByPhoneNumbers(phoneNumbers), HttpStatus.OK);
//    }
//
//    public ResponseEntity<Long> getUserIdByPhoneNumber(String phoneNumber) {
//        return new ResponseEntity<>(userRepository.findUserIdByPhoneNumber(phoneNumber), HttpStatus.OK);
//    }
//
//    public ResponseEntity<String> getPhoneNumberByUserID(Long id) {
//
//        return  new ResponseEntity<>(userRepository.findPhoneNumberByuserID(id), HttpStatus.OK);
//    }
//
//    public ResponseEntity<List<String>> getPhoneNumbersByIds(List<Long> id) {
//        return new ResponseEntity<>(userRepository.findPhoneNumbersByIds(id), HttpStatus.OK);
//    }
//
//    public String getUserById(Long id) {
//        User user= userRepository.findById(id).get();
//        return  user.getUserName();
//    }
//
//    public User createUserWithPhone(String phoneNumber) {
//        User u = new User();
//        u.setPhoneNumber(phoneNumber);
//        // Set any mandatory fields your entity requires:
//        // u.setUserName("User_" + phoneNumber); // or derive a better default
//        u.setCreatedAt(LocalDateTime.now());
//        u.setActive(true);
//        return userRepository.save(u);
//    }
//}

package com.om.backend.services;

import com.om.backend.Dto.UserProfileDto;
import com.om.backend.Model.NotificationPreferences;
import com.om.backend.Model.PrivacySettings;
import com.om.backend.Model.User;
import com.om.backend.Model.UserChatPrefs;

import com.om.backend.Repositories.UserChatPrefsRepository;
import com.om.backend.Repositories.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepo;
    private final UserChatPrefsRepository ucpRepo;


    private static final Logger log = LoggerFactory.getLogger(OtpService.class);

    public UserService(UserRepository userRepo, UserChatPrefsRepository ucpRepo) {
        this.userRepo = userRepo;
        this.ucpRepo = ucpRepo;
    }

    // -------- Profile (if you need it here) --------
    @Transactional(readOnly = true)
    public User getMe(Long userId) {
        return userRepo.findById(userId).orElseThrow();
    }

    // -------- Notification preferences --------
    @Transactional(readOnly = true)
    public NotificationPreferences getNotificationPreferences(Long userId) {
        return userRepo.findById(userId).orElseThrow().getNotificationPrefs();
    }

    @Transactional
    public NotificationPreferences updateNotificationPreferences(Long userId, NotificationPreferences in) {
        User u = userRepo.findById(userId).orElseThrow();
        u.setNotificationPrefs(in);
        u.setPrefsUpdatedAt(Instant.now());
        userRepo.save(u);
        return u.getNotificationPrefs();
    }

    // -------- Privacy settings --------
    @Transactional(readOnly = true)
    public PrivacySettings getPrivacy(Long userId) {
        return userRepo.findById(userId).orElseThrow().getPrivacySettings();
    }

    @Transactional
    public PrivacySettings updatePrivacy(Long userId, PrivacySettings in) {
        User u = userRepo.findById(userId).orElseThrow();
        u.setPrivacySettings(in);
        u.setPrefsUpdatedAt(Instant.now());
        return u.getPrivacySettings();
    }

    // -------- Per-chat mute (user × chat) --------
    @Transactional
    public Instant setChatMute(Long userId, Long chatId, Instant mutedUntil) {
        if (mutedUntil == null) {
            ucpRepo.deleteByUserIdAndChatId(userId, chatId);
            return null;
        }

        UserChatPrefs p = ucpRepo.findByUserIdAndChatId(userId, chatId).orElseGet(() -> {
            UserChatPrefs x = new UserChatPrefs();
            x.setUserId(userId);
            x.setChatId(chatId);
            return x;
        });
        p.setMutedUntil(mutedUntil);
        ucpRepo.save(p);
        return mutedUntil;
    }

    @Transactional
    public void clearChatMute(Long userId, Long chatId) {
        ucpRepo.findByUserIdAndChatId(userId, chatId).ifPresent(pref -> {
            ucpRepo.delete(pref);
            ucpRepo.flush();
        });
    }

    // -------- Phone helpers (if you already exposed these in your controller) --------
    @Transactional(readOnly = true)
    public String getUserById(Long id) {
        return userRepo.findById(id).map(User::getUserName).orElse(null);
    }

    public User getUser(String phoneNumber) {
      User user = userRepo.findByPhoneNumber(phoneNumber)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return user;
    }


    @Transactional(readOnly = true)
    public ResponseEntity<List<Long>> getUserIdsByPhoneNumbers(List<String> phoneNumbers) {
        log.info("This is the requested phoneNumber: phoneNumber={}", phoneNumbers);
        return new ResponseEntity<>(userRepo.findIdsByPhoneNumbers(phoneNumbers), HttpStatus.OK);
   }


    @Transactional(readOnly = true)
    public ResponseEntity<Long> getUserIdByPhoneNumber(String phoneNumber) {
        log.info("This is the requested phoneNumber: phoneNumber={}", phoneNumber);
        return new ResponseEntity<>(userRepo.findUserIdByPhoneNumber(phoneNumber), HttpStatus.OK);
    }


    @Transactional(readOnly = true)
    public ResponseEntity<String> getPhoneNumberByUserID(Long id) {
        log.info("This is the requested userID: UserId={}", id);
        return  new ResponseEntity<>(userRepo.findPhoneNumberByuserID(id), HttpStatus.OK);
    }


    @Transactional(readOnly = true)
    public ResponseEntity<List<String>> getPhoneNumbersByIds(List<Long> id) {
        log.info("This is the requested userID: userID={}", id);
        return new ResponseEntity<>(userRepo.findPhoneNumbersByIds(id), HttpStatus.OK);
    }


    public UserProfileDto getUserProfileById(Long aLong) {
        User user = userRepo.findById(aLong).get();
        if(user!=null){
            UserProfileDto userprofile = new UserProfileDto();
            userprofile.setId(String.valueOf(user.getId()));
            userprofile.setAvatarUrl(user.getAvatarUrl());
            userprofile.setEmail(user.getEmail());
            userprofile.setDisplayName(user.getUserName());
            return  userprofile;
        }

        return null;
    }
}

