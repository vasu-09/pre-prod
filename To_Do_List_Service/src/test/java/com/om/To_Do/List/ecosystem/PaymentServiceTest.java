package com.om.To_Do.List.ecosystem;

import com.om.To_Do.List.ecosystem.model.Subscription;
import com.om.To_Do.List.ecosystem.repository.PaymentRepository;
import com.om.To_Do.List.ecosystem.repository.ProcessedWebhookEventRepository;
import com.om.To_Do.List.ecosystem.repository.SubscriptionRepository;
import com.om.To_Do.List.ecosystem.services.PaymentService;
import com.om.To_Do.List.ecosystem.services.TokenEncryptor;
import com.razorpay.Entity;
import com.razorpay.RazorpayClient;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link PaymentService} webhook handling.
 */
public class PaymentServiceTest {

    private PaymentService paymentService;
    private SubscriptionRepository subscriptionRepo;
    private RazorpayClient razorpayClient;
    private ProcessedWebhookEventRepository processedWebhookEventRepo;

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService();
        subscriptionRepo = Mockito.mock(SubscriptionRepository.class);
        ReflectionTestUtils.setField(paymentService, "subscriptionRepo", subscriptionRepo);
        ReflectionTestUtils.setField(paymentService, "paymentRepo", Mockito.mock(PaymentRepository.class));
        processedWebhookEventRepo = Mockito.mock(ProcessedWebhookEventRepository.class);
        when(processedWebhookEventRepo.existsById(any())).thenReturn(false);
        ReflectionTestUtils.setField(paymentService, "processedWebhookEventRepo", processedWebhookEventRepo);
        ReflectionTestUtils.setField(paymentService, "webhookSecret", "secret");
        TokenEncryptor tokenEncryptor = Mockito.mock(TokenEncryptor.class);
        when(tokenEncryptor.encrypt(any())).thenAnswer(inv -> inv.getArgument(0));
        ReflectionTestUtils.setField(paymentService, "tokenEncryptor", tokenEncryptor);
        razorpayClient = Mockito.mock(RazorpayClient.class, Mockito.RETURNS_DEEP_STUBS);
        ReflectionTestUtils.setField(paymentService, "client", razorpayClient);
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
        paymentService.handleWebhook(payload, sign(payload), null);

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
        paymentService.handleWebhook(payload, sign(payload), null);

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
        paymentService.handleWebhook(payload, sign(payload), null);

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
        paymentService.handleWebhook(payload, sign(payload), null);

        assertFalse(paymentService.isSubscriptionActive(1L));
    }

    @Test
    void reconcileSubscriptionMapsActiveStatus() throws Exception {
        Subscription sub = new Subscription();
        sub.setUserId(7L);
        sub.setSubscriptionId("sub_live");
        sub.setActive(false);

        when(subscriptionRepo.findByUserId(7L)).thenReturn(Optional.of(sub));
        when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Entity fetched = Mockito.mock(Entity.class);
        when(fetched.toString()).thenReturn("{\"id\":\"sub_live\",\"status\":\"active\"}");
        when(razorpayClient.subscriptions.fetch(eq("sub_live"))).thenReturn(fetched);

        var resp = paymentService.reconcileSubscription(7L);

        assertEquals("active", resp.get("razorpayStatus"));
        assertEquals(true, resp.get("isActive"));
        assertTrue(Boolean.TRUE.equals(sub.getActive()));
    }

    @Test
    void reconcileSubscriptionMapsHaltedStatusAndClearsToken() throws Exception {
        Subscription sub = new Subscription();
        sub.setUserId(9L);
        sub.setSubscriptionId("sub_halt");
        sub.setActive(true);
        sub.setPaymentToken("encrypted-token");

        when(subscriptionRepo.findByUserId(9L)).thenReturn(Optional.of(sub));
        when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Entity fetched = Mockito.mock(Entity.class);
        when(fetched.toString()).thenReturn("{\"id\":\"sub_halt\",\"status\":\"halted\"}");
        when(razorpayClient.subscriptions.fetch(eq("sub_halt"))).thenReturn(fetched);

        var resp = paymentService.reconcileSubscription(9L);

        assertEquals("halted", resp.get("razorpayStatus"));
        assertEquals(false, resp.get("isActive"));
        assertFalse(Boolean.TRUE.equals(sub.getActive()));
        assertNull(sub.getPaymentToken());
    }

    @Test
    void reconcileSubscriptionMapsExpiredStatusAndClearsToken() throws Exception {
        Subscription sub = new Subscription();
        sub.setUserId(10L);
        sub.setSubscriptionId("sub_expired");
        sub.setActive(true);
        sub.setPaymentToken("encrypted-token");

        when(subscriptionRepo.findByUserId(10L)).thenReturn(Optional.of(sub));
        when(subscriptionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Entity fetched = Mockito.mock(Entity.class);
        when(fetched.toString()).thenReturn("{\"id\":\"sub_expired\",\"status\":\"expired\"}");
        when(razorpayClient.subscriptions.fetch(eq("sub_expired"))).thenReturn(fetched);

        var resp = paymentService.reconcileSubscription(10L);

        assertEquals("expired", resp.get("razorpayStatus"));
        assertEquals(false, resp.get("isActive"));
        assertFalse(Boolean.TRUE.equals(sub.getActive()));
        assertNull(sub.getPaymentToken());
    }

    @Test
    void duplicateWebhookEventIdIsIgnored() {
        when(processedWebhookEventRepo.existsById("evt_1")).thenReturn(true);

        String payload = "{ \"event\":\"subscription.activated\", \"payload\":{\"subscription\":{\"entity\":{\"id\":\"sub_123\"}}}}";
        paymentService.handleWebhook(payload, sign(payload), "evt_1");

        Mockito.verify(subscriptionRepo, Mockito.never()).save(any());
    }

    @Test
    void createSubscriptionReusesExistingProvisioningSubscription() throws Exception {
        Subscription sub = new Subscription();
        sub.setUserId(15L);
        sub.setSubscriptionId("sub_existing");

        when(subscriptionRepo.findByUserId(15L)).thenReturn(Optional.of(sub));

        Entity existing = Mockito.mock(Entity.class);
        when(existing.toString()).thenReturn("{\"id\":\"sub_existing\",\"status\":\"active\",\"short_url\":\"https://rzp.io/i/existing\"}");
        when(razorpayClient.subscriptions.fetch(eq("sub_existing"))).thenReturn(existing);

        var resp = paymentService.createSubscription(15L, "user@example.com", "9999999999");

        assertEquals("sub_existing", resp.get("subscriptionId"));
        assertEquals(true, resp.get("reused"));
        Mockito.verify(razorpayClient.subscriptions, Mockito.never()).create(any());
    }
}
