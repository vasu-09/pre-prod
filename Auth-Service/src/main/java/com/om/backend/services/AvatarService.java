// com/om/backend/service/AvatarService.java
package com.om.backend.services;

import com.om.backend.Dto.*;
import com.om.backend.Model.User;
import com.om.backend.Repositories.UserRepository;
import com.om.backend.client.MediaClient;
import com.om.backend.exceptions.BadRequestException;
import com.om.backend.exceptions.ForbiddenException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AvatarService {


    private final UserRepository userRepo;

    private final MediaClient mediaClient; // your Feign/RestTemplate to RTC

    @Value("${media.bucket:moc-prod}")
    private String bucket;

    public AvatarService(UserRepository userRepo, MediaClient mediaClient) {
        this.userRepo = userRepo;
        this.mediaClient = mediaClient;
    }

    // 5 MB default
    private static final long MAX_SIZE_BYTES = 5L * 1024 * 1024;

    public AvatarIntentResp createIntent(Long userId, AvatarIntentReq req) {
        // Validate inputs
        if (req.getSize() <= 0 || req.getSize() > MAX_SIZE_BYTES) {
            throw new BadRequestException("Invalid file size");
        }
        if (req.getContentType() == null) {
            throw new BadRequestException("Missing contentType");
        }

        User user = userRepo.findById(userId).orElseThrow(() -> new BadRequestException("User not found"));

        int nextVer = nextAvatarVersionFor(user); // compute from current avatarKey
        String ext = toExt(req.getContentType());
        String hash = (req.getSha256() == null || req.getSha256().isBlank())
                ? UUID.randomUUID().toString().replace("-", "")
                : req.getSha256();

        String key = String.format("avatars/%s/v%d/%s.%s", userId, nextVer, hash, ext);

        MediaUploadIntent intent = new MediaUploadIntent(bucket, key, req.getContentType(), req.getSize(), req.getSha256(), 600);
        MediaUploadIntentResp signed = mediaClient.uploadIntent(intent);

        return new AvatarIntentResp(
                key,
                signed.getPutUrl(),
                signed.getExpiresAt(),
                Long.valueOf(MAX_SIZE_BYTES) // <<< fix: pass Long, not int
        );
    }

    @Transactional
    public User commit(Long userId, AvatarCommitReq req) {
        if (req.getKey() == null || !req.getKey().startsWith("avatars/" + userId + "/")) {
            throw new ForbiddenException("Key must be under avatars/" + userId + "/");
        }

        MediaHeadResp head = mediaClient.head(new MediaHeadReq(bucket, req.getKey()));
        if (head == null || !head.isExists()) {
            throw new BadRequestException("Uploaded object not found");
        }
        if (req.getSize() > 0 && head.getSize() != req.getSize()) {
            throw new BadRequestException("Uploaded size mismatch");
        }

        User u = userRepo.findById(userId).orElseThrow(() -> new BadRequestException("User not found"));
        u.setAvatarKey(req.getKey());
        u.setAvatarUpdatedAt(Instant.now());
        return userRepo.save(u);
    }

    // Helpers
    private static String toExt(String contentType) {
        return switch (contentType) {
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "bin";
        };
    }

    private static final Pattern V_PATTERN = Pattern.compile("/v(\\d+)/");

    private static int nextAvatarVersionFor(User u) {
        String key = u.getAvatarKey();
        if (key == null || key.isBlank()) return 1;
        Matcher m = V_PATTERN.matcher(key);
        if (m.find()) {
            try { return Integer.parseInt(m.group(1)) + 1; }
            catch (NumberFormatException ignore) { /* fallthrough */ }
        }
        return 1;
    }
}
