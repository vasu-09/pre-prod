package com.om.To_Do.List.ecosystem;

import com.om.To_Do.List.ecosystem.dto.CreateChecklistRequest;
import com.om.To_Do.List.ecosystem.dto.CreateListRequest;
import com.om.To_Do.List.ecosystem.dto.ToDoItemDTO;
import com.om.To_Do.List.ecosystem.model.Subscription;
import com.om.To_Do.List.ecosystem.repository.*;
//import com.om.To_Do.List.ecosystem.client.UserServiceClient;
import com.om.To_Do.List.ecosystem.services.PaymentService;
import com.om.To_Do.List.ecosystem.services.ToDoListService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.mockito.Mockito;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.nio.file.AccessDeniedException;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Integration-style tests covering access control for premium features.
 */
public class ToDoListServiceAccessTest {

    private ToDoListService toDoListService;
    private PaymentService paymentService;
    private SubscriptionRepository subscriptionRepo;

    @BeforeEach
    void setUp() {
        subscriptionRepo = Mockito.mock(SubscriptionRepository.class);
        paymentService = new PaymentService();
        ReflectionTestUtils.setField(paymentService, "subscriptionRepo", subscriptionRepo);
        ReflectionTestUtils.setField(paymentService, "paymentRepo", Mockito.mock(PaymentRepository.class));
        ReflectionTestUtils.setField(paymentService, "webhookSecret", "secret");

        toDoListService = new ToDoListService();
        ReflectionTestUtils.setField(toDoListService, "toDoListRepository", Mockito.mock(ToDoListRepository.class));
        ReflectionTestUtils.setField(toDoListService, "toDoItemRepository", Mockito.mock(ToDoItemRepository.class));
        ReflectionTestUtils.setField(toDoListService, "listRecipientRepository", Mockito.mock(ListRecipientRepository.class));
        ReflectionTestUtils.setField(toDoListService, "eventPublisher", Mockito.mock(ApplicationEventPublisher.class));
//        ReflectionTestUtils.setField(toDoListService, "userServiceClient", Mockito.mock(UserServiceClient.class));
        ReflectionTestUtils.setField(toDoListService, "paymentService", paymentService);
        ReflectionTestUtils.setField(toDoListService, "objectMapper", new ObjectMapper());
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
    void subscriptionFlowControlsAccess() throws Exception {
        Subscription sub = new Subscription();
        sub.setUserId(1L);
        sub.setSubscriptionId("sub_123");
        sub.setActive(false);

        when(subscriptionRepo.findBySubscriptionId("sub_123")).thenReturn(Optional.of(sub));
        when(subscriptionRepo.findByUserId(1L)).thenReturn(Optional.of(sub));
        when(subscriptionRepo.save(any())).thenAnswer(inv -> {
            Subscription s = inv.getArgument(0);
            sub.setActive(s.getActive());
            sub.setExpiryDate(s.getExpiryDate());
            return s;
        });

        CreateListRequest listReq = new CreateListRequest(1L, "Premium", List.of(new ToDoItemDTO("item","1","10",null)));
        CreateChecklistRequest checkReq = new CreateChecklistRequest(1L, "Simple",
                List.of(new CreateChecklistRequest.ChecklistItemDTO("c1")));

        // Free user: premium feature denied, free feature allowed
        assertThrows(AccessDeniedException.class, () -> toDoListService.createList(listReq));
        assertDoesNotThrow(() -> toDoListService.createChecklist(checkReq));

        // Activate subscription -> premium allowed
        String activatePayload = "{ \"event\":\"subscription.activated\", \"payload\":{\"subscription\":{\"entity\":{\"id\":\"sub_123\"}}}}";
        paymentService.handleWebhook(activatePayload, sign(activatePayload));
        assertDoesNotThrow(() -> toDoListService.createList(listReq));

        // Renewal payment keeps access
        String paidPayload = "{ \"event\":\"invoice.paid\", \"payload\":{\"invoice\":{\"entity\":{\"subscription_id\":\"sub_123\"}}}}";
        paymentService.handleWebhook(paidPayload, sign(paidPayload));
        assertDoesNotThrow(() -> toDoListService.createList(listReq));

        // Payment failure revokes access
        String failPayload = "{ \"event\":\"invoice.payment_failed\", \"payload\":{\"invoice\":{\"entity\":{\"subscription_id\":\"sub_123\"}}}}";
        paymentService.handleWebhook(failPayload, sign(failPayload));
        assertThrows(AccessDeniedException.class, () -> toDoListService.createList(listReq));

        // Reactivate and then cancel
        paymentService.handleWebhook(activatePayload, sign(activatePayload));
        assertDoesNotThrow(() -> toDoListService.createList(listReq));
        String cancelPayload = "{ \"event\":\"subscription.cancelled\", \"payload\":{\"subscription\":{\"entity\":{\"id\":\"sub_123\"}}}}";
        paymentService.handleWebhook(cancelPayload, sign(cancelPayload));
        assertThrows(AccessDeniedException.class, () -> toDoListService.createList(listReq));
    }
}
