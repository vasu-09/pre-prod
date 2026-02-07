package com.om.To_Do.List.ecosystem;

import com.om.To_Do.List.ecosystem.model.Subscription;
import com.om.To_Do.List.ecosystem.repository.PaymentRepository;
import com.om.To_Do.List.ecosystem.repository.SubscriptionRepository;
import com.om.To_Do.List.ecosystem.services.PaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link PaymentService} webhook handling.
 */
public class PaymentServiceTest {

    private PaymentService paymentService;
    private SubscriptionRepository subscriptionRepo;

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService();
        subscriptionRepo = Mockito.mock(SubscriptionRepository.class);
        ReflectionTestUtils.setField(paymentService, "subscriptionRepo", subscriptionRepo);
        ReflectionTestUtils.setField(paymentService, "paymentRepo", Mockito.mock(PaymentRepository.class));
        ReflectionTestUtils.setField(paymentService, "webhookSecret", "secret");
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec("secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] bytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void subscriptionActivationMarksUserActive() {
        Subscription sub = new Subscription();
        sub.setUserId(1L);
        sub.setSubscriptionId("sub_123");
        sub.setActive(false);

        when(subscriptionRepo.findBySubscriptionId("sub_123")).thenReturn(Optional.of(sub));
        when(subscriptionRepo.findByUserId(1L)).thenReturn(Optional.of(sub));
        when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        String payload = "{ \"event\":\"subscription.activated\", \"payload\":{\"subscription\":{\"entity\":{\"id\":\"sub_123\"}}}}";
        paymentService.handleWebhook(payload, sign(payload));

        assertTrue(paymentService.isSubscriptionActive(1L));
    }

    @Test
    void invoicePaidExtendsExpiry() {
        Subscription sub = new Subscription();
        sub.setUserId(1L);
        sub.setSubscriptionId("sub_123");
        sub.setActive(true);
        sub.setExpiryDate(LocalDate.now().plusDays(5));

        when(subscriptionRepo.findBySubscriptionId("sub_123")).thenReturn(Optional.of(sub));
        when(subscriptionRepo.findByUserId(1L)).thenReturn(Optional.of(sub));
        when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        LocalDate before = sub.getExpiryDate();
        String payload = "{ \"event\":\"invoice.paid\", \"payload\":{\"invoice\":{\"entity\":{\"subscription_id\":\"sub_123\"}}}}";
        paymentService.handleWebhook(payload, sign(payload));

        assertTrue(paymentService.isSubscriptionActive(1L));
        assertTrue(sub.getExpiryDate().isAfter(before));
    }

    @Test
    void invoiceFailedMarksInactive() {
        Subscription sub = new Subscription();
        sub.setUserId(1L);
        sub.setSubscriptionId("sub_123");
        sub.setActive(true);

        when(subscriptionRepo.findBySubscriptionId("sub_123")).thenReturn(Optional.of(sub));
        when(subscriptionRepo.findByUserId(1L)).thenReturn(Optional.of(sub));
        when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        String payload = "{ \"event\":\"invoice.payment_failed\", \"payload\":{\"invoice\":{\"entity\":{\"subscription_id\":\"sub_123\"}}}}";
        paymentService.handleWebhook(payload, sign(payload));

        assertFalse(paymentService.isSubscriptionActive(1L));
    }

    @Test
    void subscriptionCancelledMarksInactive() {
        Subscription sub = new Subscription();
        sub.setUserId(1L);
        sub.setSubscriptionId("sub_123");
        sub.setActive(true);

        when(subscriptionRepo.findBySubscriptionId("sub_123")).thenReturn(Optional.of(sub));
        when(subscriptionRepo.findByUserId(1L)).thenReturn(Optional.of(sub));
        when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        String payload = "{ \"event\":\"subscription.cancelled\", \"payload\":{\"subscription\":{\"entity\":{\"id\":\"sub_123\"}}}}";
        paymentService.handleWebhook(payload, sign(payload));

        assertFalse(paymentService.isSubscriptionActive(1L));
    }
}
