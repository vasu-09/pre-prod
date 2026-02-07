package com.om.To_Do.List.ecosystem.controller;
import com.om.To_Do.List.ecosystem.services.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed-origins}")
public class PaymentController {

    @Autowired
    private  PaymentService paymentService;

    /**
     * Create a Razorpay Subscription (Autopay) with RBI/UPI guardrails.
     * Body: { "userId": 123, "planId": "plan_XXXX", "email": "u@x.com", "contact": "91xxxxxxxxxx" }
     */
    @PostMapping("/subscriptions")
    public ResponseEntity<?> createSubscription(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String planId = body.get("planId").toString();
        String email = body.get("email") == null ? null : body.get("email").toString();
        String contact = body.get("contact") == null ? null : body.get("contact").toString();

        var resp = paymentService.createSubscription(userId, planId, email, contact);
        return ResponseEntity.ok(resp);
    }

    /**
     * Cancel a subscription (immediately or at cycle end).
     */
    @PostMapping("/subscriptions/{subscriptionId}/cancel")
    public ResponseEntity<?> cancelSubscription(@PathVariable String subscriptionId,
                                                @RequestParam(required = false, defaultValue = "false") boolean cancelAtCycleEnd) {
        var resp = paymentService.cancelSubscription(subscriptionId, cancelAtCycleEnd);
        return ResponseEntity.ok(resp);
    }

    /**
     * Local subscription status by userId.
     */
    @GetMapping("/subscription/{userId}/status")
    public ResponseEntity<?> status(@PathVariable Long userId) {
        boolean active = paymentService.isSubscriptionActive(userId);
        return ResponseEntity.ok(Map.of("userId", userId, "isActive", active));
    }

    /**
     * Razorpay webhook receiver.
     * Make sure to configure the same webhook secret in your application config and Razorpay dashboard.
     */
    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(@RequestHeader("X-Razorpay-Signature") String signature,
                                     @RequestBody String payload) {
        paymentService.handleWebhook(payload, signature);
        return ResponseEntity.ok(Map.of("ok", true));
    }


}