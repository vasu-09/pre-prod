package com.om.backend.services;

import com.om.backend.Dto.ContactMatchDto;
import com.om.backend.util.PhoneNumberCanonicalizer;
import com.om.backend.util.PhoneNumberUtil1;
import com.om.backend.Model.User;
import com.om.backend.Repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;

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

        Set<String> normalized = rawPhones.stream()
                .filter(StringUtils::hasText)
                .flatMap(phone -> buildLookupCandidates(phone).stream())
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        if (normalized.isEmpty()) {
            log.warn("Contact sync normalized 0 phone numbers after filtering invalid input");
            log.warn("Contact sync returning 0 matched phone numbers");
            return List.of();
        }

        log.warn("Contact sync normalized {} phone numbers: {}", normalized.size(), normalized);
        Set<User> users = new LinkedHashSet<>(userRepo.findByPhoneNumberIn(List.copyOf(normalized)));

        Set<String> canonicalDigits = normalized.stream()
                .map(this::digitsOnly)
                .filter(StringUtils::hasText)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        if (!canonicalDigits.isEmpty()) {
            users.addAll(userRepo.findByPhoneNumberCanonicalDigitsIn(List.copyOf(canonicalDigits)));
        }
        List<ContactMatchDto> matches = users.stream()
                .map(u -> new ContactMatchDto(u.getId(), u.getPhoneNumber()))
                .toList();

        log.warn("Contact sync returning {} matched phone numbers: {}", matches.size(),
                matches.stream().map(ContactMatchDto::getPhone).toList());
        return matches;
    }

    private String safeNormalize(String phone) {
        try {
            return phoneCanonicalizer.normalize(phone);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

   private Set<String> buildLookupCandidates(String rawPhone) {
        Set<String> variants = new LinkedHashSet<>();

        String configuredNormalized = safeNormalize(rawPhone);
        if (configuredNormalized != null) {
            variants.add(configuredNormalized);
            if (configuredNormalized.startsWith("+")) {
                variants.add(configuredNormalized.substring(1));
            }
        }

        try {
            String e164 = PhoneNumberUtil1.toE164India(rawPhone);
            variants.add(e164);
            variants.add(e164.substring(1));
            variants.add(PhoneNumberUtil1.toIndiaNsn10(rawPhone));
        } catch (IllegalArgumentException ex) {
            log.warn("Skipping invalid phone number during contact sync: {}", rawPhone);
        }

        return variants;
    }
   
   private String digitsOnly(String input) {
        return input == null ? "" : input.replaceAll("[^0-9]", "");
    }
}