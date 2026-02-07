package com.om.backend.services;

import com.om.backend.Dto.ContactMatchDto;
import com.om.backend.util.PhoneNumberCanonicalizer;
import com.om.backend.Model.User;
import com.om.backend.Repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ContactSyncService {
   private static final Logger log = LoggerFactory.getLogger(ContactSyncService.class);

    private final UserRepository userRepo;
    private final PhoneNumberCanonicalizer phoneCanonicalizer;

    public List<ContactMatchDto> match(List<String> rawPhones) {
        if (rawPhones == null || rawPhones.isEmpty()) return List.of();

        List<String> normalized = rawPhones.stream()
                .filter(StringUtils::hasText)
                .map(this::safeNormalize)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (normalized.isEmpty()) return List.of();
        // batch find: create an index on phone_number
        List<User> users = userRepo.findByPhoneNumberIn(normalized);
        return users.stream()
                .map(u -> new ContactMatchDto(u.getId(), u.getPhoneNumber()))
                .toList();
    }

    private String safeNormalize(String phone) {
        try {
            return phoneCanonicalizer.normalize(phone);
        } catch (IllegalArgumentException ex) {
            log.warn("Skipping invalid phone number during contact sync: {}", phone);
            return null;
        }
    }
}
