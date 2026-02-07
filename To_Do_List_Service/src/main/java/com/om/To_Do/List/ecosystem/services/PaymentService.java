package com.om.To_Do.List.ecosystem.services;

import com.om.To_Do.List.ecosystem.model.Subscription;
import com.om.To_Do.List.ecosystem.repository.PaymentRepository;
import com.om.To_Do.List.ecosystem.repository.SubscriptionRepository;
import org.springframework.scheduling.annotation.Scheduled;
import com.razorpay.Entity;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import lombok.RequiredArgsConstructor;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class PaymentService {

    @Autowired
    private  PaymentRepository paymentRepo;
    @Autowired
    private  SubscriptionRepository subscriptionRepo;

    @Autowired
    private TokenEncryptor tokenEncryptor;
    @Value("${razorpay.key:}")
    private String keyId;
    @Value("${razorpay.secret:}")
    private String keySecret;

    @Value("${razorpay.webhookSecret:}") private String webhookSecret;

    private RazorpayClient client;

    private RazorpayClient client() throws RazorpayException {
        if (client == null) client = new RazorpayClient(keyId, keySecret);
        return client;
    }

    // ---- NPCI non-peak windows (Asia/Kolkata) ----
    // Allowed windows (typical guidance): before 10:00, 13:00–17:00, after 21:30 IST.
    private Instant nextNonPeakInstant() {
        ZoneId IST = ZoneId.of("Asia/Kolkata");
        ZonedDateTime now = ZonedDateTime.now(IST);
        LocalTime t = now.toLocalTime();

        ZonedDateTime target;
        if (t.isBefore(LocalTime.of(10, 0))) {
            target = now.withHour(9).withMinute(30).withSecond(0).withNano(0);    // 09:30
        } else if (t.isBefore(LocalTime.of(13, 0))) {
            target = now.withHour(13).withMinute(30).withSecond(0).withNano(0);   // 13:30
        } else if (t.isBefore(LocalTime.of(17, 0))) {
            target = now.withHour(13).withMinute(30).withSecond(0).withNano(0);   // 13:30 (still valid)
        } else if (t.isBefore(LocalTime.of(21, 30))) {
            target = now.withHour(21).withMinute(45).withSecond(0).withNano(0);   // 21:45
        } else {
            target = now.plusDays(1).withHour(9).withMinute(30).withSecond(0).withNano(0);
        }
        if (target.isBefore(now)) target = target.plusDays(1);
        return target.toInstant();
    }

    /**
     * Create a Razorpay Subscription (recurring autopay) with RBI/UPI guardrails:
     *  - Ensure plan amount <= INR 15,000 (OTP threshold) to avoid per-cycle OTP
     *  - Provide notify_info so bank/PSP can send pre-/post-debit notices
     *  - Start at a non-peak window per NPCI UPI guidelines
     */
    @Transactional
    public Map<String, Object> createSubscription(Long userId, String planId, String email, String contact) {
        try {
            // 1) Fetch plan and validate amount (Razorpay amounts are in paise)
            Entity plan = client().plans.fetch(planId);
            // plan.get("item") returns a nested JSON object; cast to org.json.JSONObject
            JSONObject item = (JSONObject) plan.get("item");
            long amountPaise = item.getLong("amount");
            if (amountPaise > 1_500_000L) { // 15,00,000 paise = ₹15,000
                throw new IllegalArgumentException(
                        "Plan amount exceeds INR 15,000. RBI requires OTP per charge; use a lower-amount plan.");
            }

            // 2) Compute a non-peak start time (epoch seconds)
            long startAt = nextNonPeakInstant().getEpochSecond();

            // 3) Build subscription request
            JSONObject req = new JSONObject();
            req.put("plan_id", planId);
            req.put("customer_notify", 1);
            req.put("start_at", startAt); // schedule in non-peak window

            if (email != null || contact != null) {
                JSONObject notify = new JSONObject();
                if (email != null)   notify.put("email", email);
                if (contact != null) notify.put("contact", contact);
                req.put("notify_info", notify);
            }

            JSONObject notes = new JSONObject();
            notes.put("app_user_id", userId.toString());
            req.put("notes", notes);

            // Create subscription (returns com.razorpay.Subscription which extends Entity)
            Entity created = client().subscriptions.create(req);
            String subscriptionId = created.get("id");
            String shortUrl = created.has("short_url") ? created.get("short_url") : null;

            // 4) Upsert local record (inactive until webhook confirms)
            Subscription sub = subscriptionRepo.findByUserId(userId).orElseGet(Subscription::new);
            sub.setUserId(userId);
            sub.setSubscriptionId(subscriptionId);
            sub.setActive(false);
            LocalDate todayIST = LocalDate.now(ZoneId.of("Asia/Kolkata"));
            sub.setStartDate(todayIST);
            sub.setExpiryDate(todayIST); // extend on invoice.paid
            subscriptionRepo.save(sub);

            Map<String, Object> resp = new HashMap<>();
            resp.put("subscriptionId", subscriptionId);
            resp.put("shortUrl", shortUrl);
            resp.put("startAt", startAt);
            resp.put("message", "Subscription created. Redirect user to shortUrl for mandate authorization.");
            return resp;
        } catch (Exception e) {
            throw new RuntimeException("Failed to create subscription: " + e.getMessage(), e);
        }

    }

    /**
     * Cancel subscription on Razorpay and mark inactive locally.
     */
    @Transactional
    public Map<String, Object> cancelSubscription(String subscriptionId, boolean cancelAtCycleEnd) {
        try {
            JSONObject req = new JSONObject();
            req.put("cancel_at_cycle_end", cancelAtCycleEnd);
            Entity canceled = client().subscriptions.cancel(subscriptionId, req);

            Optional<Subscription> opt = subscriptionRepo.findBySubscriptionId(subscriptionId);
            opt.ifPresent(sub -> {
                sub.setActive(false);
                subscriptionRepo.save(sub);
            });

            Map<String, Object> resp = new HashMap<>();
            resp.put("status", "cancelled");
            resp.put("subscriptionId", subscriptionId);
            resp.put("cancelAtCycleEnd", cancelAtCycleEnd);
            return resp;
        } catch (Exception e) {
            throw new RuntimeException("Failed to cancel subscription: " + e.getMessage(), e);
        }

    }

    /**
     * Handle Razorpay webhooks: verify signature then route to handlers.
     * Important events:
     *  - subscription.activated  -> mark active and seed expiry
     *  - invoice.paid            -> extend expiry by one cycle
     *  - invoice.payment_failed  -> mark inactive (or add grace logic)
     *  - subscription.cancelled  -> mark inactive
     */
    @Transactional
    public void handleWebhook(String payload, String signature) {
        try {
            Utils.verifyWebhookSignature(payload, signature, webhookSecret);

            JSONObject root = new JSONObject(payload);
            String event = root.optString("event", "");

            JSONObject payloadObj = root.optJSONObject("payload");
            JSONObject subEntity = null;
            JSONObject invEntity = null;
            if (payloadObj != null) {
                if (payloadObj.optJSONObject("subscription") != null) {
                    subEntity = payloadObj.getJSONObject("subscription").optJSONObject("entity");
                }
                if (payloadObj.optJSONObject("invoice") != null) {
                    invEntity = payloadObj.getJSONObject("invoice").optJSONObject("entity");
                }
            }

            switch (event) {
                case "subscription.activated":
                    onSubscriptionActivated(subEntity);
                    break;

                case "subscription.paused":
                case "subscription.cancelled":
                case "subscription.completed":
                    onSubscriptionInactive(subEntity);
                    break;

                case "invoice.paid":
                    onInvoicePaid(invEntity);
                    break;

                case "invoice.payment_failed":
                    onInvoiceFailed(invEntity);
                    break;

                default:
                    // ignore others
            }

        } catch (Exception e) {
            throw new RuntimeException("Webhook verification/handling failed: " + e.getMessage(), e);
        }
    }

    private void onSubscriptionActivated(JSONObject subEntity) {
        if (subEntity == null) return;
        String subscriptionId = subEntity.optString("id", null);
        if (subscriptionId == null) return;

        subscriptionRepo.findBySubscriptionId(subscriptionId).ifPresent(sub -> {
            sub.setActive(true);
            LocalDate todayIST = LocalDate.now(ZoneId.of("Asia/Kolkata"));
            if (sub.getExpiryDate() == null || sub.getExpiryDate().isBefore(todayIST)) {
                // Default monthly; change if your plan is different
                sub.setExpiryDate(todayIST.plusDays(30));
            }
            String customerId = subEntity.optString("customer_id", null);
            String tokenId = subEntity.optString("token_id", null);
            if (customerId != null) sub.setCustomerId(customerId);
            if (tokenId != null) sub.setPaymentToken(tokenEncryptor.encrypt(tokenId));
            subscriptionRepo.save(sub);
        });
    }

    private void onSubscriptionInactive(JSONObject subEntity) {
        if (subEntity == null) return;
        String subscriptionId = subEntity.optString("id", null);
        if (subscriptionId == null) return;

        subscriptionRepo.findBySubscriptionId(subscriptionId).ifPresent(sub -> {
            sub.setActive(false);
            sub.setPaymentToken(null); // remove stored token when subscription is inactive
            subscriptionRepo.save(sub);
        });
    }

    private void onInvoicePaid(JSONObject invoiceEntity) {
        if (invoiceEntity == null) return;
        String subscriptionId = invoiceEntity.optString("subscription_id", null);
        if (subscriptionId == null) return;

        subscriptionRepo.findBySubscriptionId(subscriptionId).ifPresent(sub -> {
            ZoneId IST = ZoneId.of("Asia/Kolkata");
            LocalDate today = LocalDate.now(IST);
            LocalDate base = (sub.getExpiryDate() != null && sub.getExpiryDate().isAfter(today))
                    ? sub.getExpiryDate() : today;
            sub.setActive(true);
            sub.setExpiryDate(base.plusDays(30)); // Default to monthly cycles
            // reset failure tracking on successful renewal
            sub.setFailureCount(0);
            sub.setLastFailureAt(null);
            subscriptionRepo.save(sub);
        });
    }

    private void onInvoiceFailed(JSONObject invoiceEntity) {
        if (invoiceEntity == null) return;
        String subscriptionId = invoiceEntity.optString("subscription_id", null);
        if (subscriptionId == null) return;

        subscriptionRepo.findBySubscriptionId(subscriptionId).ifPresent(sub -> {
            ZoneId IST = ZoneId.of("Asia/Kolkata");
            LocalDateTime now = LocalDateTime.now(IST);
            int failures = sub.getFailureCount() == null ? 0 : sub.getFailureCount();
            failures++;
            sub.setFailureCount(failures);
            sub.setLastFailureAt(now);
            // RBI/NPCI guidelines require mandate suspension on any failed debit.
            // Immediately revoke premium access so paywall-enforced features block
            // until the user successfully retries the payment and we receive
            // another `invoice.paid`/`subscription.activated` event.
            sub.setActive(false);
            // We also clamp expiry to "now" so subsequent checks treat the
            // subscription as lapsed even if the previous expiry date was in the
            // future. This keeps the access check deterministic in unit tests and
            // mirrors the production expectation.
            LocalDate today = LocalDate.now(IST);
            if (sub.getExpiryDate() == null || sub.getExpiryDate().isAfter(today)) {
                sub.setExpiryDate(today);
            }
            subscriptionRepo.save(sub);
        });
    }

    @Scheduled(cron = "0 0 0 * * *", zone = "Asia/Kolkata")
    public void revokeAfterGracePeriod() {
        LocalDateTime cutoff = LocalDateTime.now(ZoneId.of("Asia/Kolkata")).minusDays(3);
        subscriptionRepo.findAll().forEach(sub -> {
            if (Boolean.TRUE.equals(sub.getActive()) &&
                    sub.getFailureCount() != null && sub.getFailureCount() > 0 &&
                    sub.getLastFailureAt() != null && sub.getLastFailureAt().isBefore(cutoff)) {
                sub.setActive(false);
                sub.setPaymentToken(null);
                subscriptionRepo.save(sub);
            }
        });
    }
    public boolean isSubscriptionActive(Long userId) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        return subscriptionRepo.findByUserId(userId)
               .map(sub -> {
                    boolean activeFlag = Boolean.TRUE.equals(sub.getActive());
                    LocalDate expiry = sub.getExpiryDate();
                    if (!activeFlag || expiry == null) {
                        return false;
                    }
                    return !expiry.isBefore(today);
                })
                .orElse(false);
    }
}
