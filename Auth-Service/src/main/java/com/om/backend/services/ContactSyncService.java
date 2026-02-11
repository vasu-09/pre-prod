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
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ContactSyncService {
   private static final Logger log = LoggerFactory.getLogger(ContactSyncService.class);
   private static final Pattern PHONE_ALLOWED_CHARS = Pattern.compile("[^0-9+]");

    private final UserRepository userRepo;
    private final PhoneNumberCanonicalizer phoneCanonicalizer;

    public List<ContactMatchDto> match(List<String> rawPhones) {
        if (rawPhones == null || rawPhones.isEmpty()) {
            log.info("Contact sync called with no phone numbers to process");
            return List.of();
        }

        List<String> sanitizedPhones = sanitizeInputPhones(rawPhones);
        log.info("Contact sync received {} phone entries; {} non-empty values after basic sanitization",
                rawPhones.size(), sanitizedPhones.size());

        Set<String> normalized = sanitizedPhones.stream()
                .flatMap(phone -> buildLookupCandidates(phone).stream())
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        if (normalized.isEmpty()) {
             log.info("Contact sync normalized 0 phone numbers after filtering invalid input");
            return List.of();
        }

        log.info("Contact sync normalized {} unique phone variants for lookup", normalized.size());
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

        log.info("Contact sync returning {} matched phone numbers", matches.size());
        return matches;
    }

   private List<String> sanitizeInputPhones(List<String> rawPhones) {
        return rawPhones.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .map(phone -> PHONE_ALLOWED_CHARS.matcher(phone).replaceAll(""))
                .filter(StringUtils::hasText)
                .toList();
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

        String e164 = safeNormalize(rawPhone);
        if (e164 == null) {
            log.debug("Skipping invalid phone number during contact sync");
            return variants;
        }
        variants.add(e164);
        variants.add(e164.substring(1));
        try {
            variants.add(PhoneNumberUtil1.toIndiaNsn10(e164));
        } catch (IllegalArgumentException ex) {
            log.debug("Skipping NSN variant for non-mobile number during contact sync");
        }
        return variants;
    }
   
   private String digitsOnly(String input) {
        return input == null ? "" : input.replaceAll("[^0-9]", "");
    }
}