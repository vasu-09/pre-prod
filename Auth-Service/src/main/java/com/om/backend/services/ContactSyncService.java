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
        if (rawPhones == null || rawPhones.isEmpty()) {
            log.info("Contact sync called with no phone numbers to process");
            return List.of();
        }

        log.info("Contact sync received {} phone numbers from client: {}", rawPhones.size(), rawPhones);

        List<String> normalized = rawPhones.stream()
                .filter(StringUtils::hasText)
                .map(this::safeNormalize)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (normalized.isEmpty()) {
            log.info("Contact sync has no valid phone numbers after normalization");
            return List.of();
        }

        log.info("Contact sync normalized {} phone numbers: {}", normalized.size(), normalized);
        // batch find: create an index on phone_number
        List<User> users = userRepo.findByPhoneNumberIn(normalized);
        List<ContactMatchDto> matches = users.stream()
                .map(u -> new ContactMatchDto(u.getId(), u.getPhoneNumber()))
                .toList();

        log.info("Contact sync returning {} matched phone numbers: {}", matches.size(),
                matches.stream().map(ContactMatchDto::getPhone).toList());
        return matches;
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
