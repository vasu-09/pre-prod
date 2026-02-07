package com.om.Real_Time_Communication;

import com.om.Real_Time_Communication.dto.ChatSendDto;
import com.om.Real_Time_Communication.models.ChatMessage;
import com.om.Real_Time_Communication.models.MessageType;
import com.om.Real_Time_Communication.service.MessageService;
import com.om.Real_Time_Communication.service.MessageService.DirectRoomPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Verifies that encrypted chat payloads pass through the service unchanged.
 */
public class MessageServiceE2eeTest {

    private MessageService messageService;
    private com.om.Real_Time_Communication.Repository.ChatMessageRepository chatRepo;
    private com.om.Real_Time_Communication.service.ChatRoomService aclService;
    private DirectRoomPolicy directPolicy;
    private com.om.Real_Time_Communication.service.InboxDeliveryService inboxDeliveryService;

    @BeforeEach
    void setUp() {
        messageService = new MessageService();
        chatRepo = Mockito.mock(com.om.Real_Time_Communication.Repository.ChatMessageRepository.class);
        aclService = Mockito.mock(com.om.Real_Time_Communication.service.ChatRoomService.class);
        directPolicy = Mockito.mock(DirectRoomPolicy.class);
        inboxDeliveryService = Mockito.mock(com.om.Real_Time_Communication.service.InboxDeliveryService.class);

        ReflectionTestUtils.setField(messageService, "chatMessageRepository", chatRepo);
        ReflectionTestUtils.setField(messageService, "aclService", aclService);
        ReflectionTestUtils.setField(messageService, "directPolicy", directPolicy);
        ReflectionTestUtils.setField(messageService, "inboxDeliveryService", inboxDeliveryService);
    }

    @Test
    void encryptedPayloadIsPersistedUnchanged() throws Exception {
        when(aclService.canPublish(1L, Long.valueOf("99"))).thenReturn(true);
        when(directPolicy.isDirect(99L)).thenReturn(false);
        when(chatRepo.findByRoomIdAndMessageId(99L, "m1")).thenReturn(Optional.empty());
        when(chatRepo.save(any(ChatMessage.class))).thenAnswer(inv -> inv.getArgument(0));

        byte[] key = new byte[16];
        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(key);
        new SecureRandom().nextBytes(iv);

        SecretKeySpec keySpec = new SecretKeySpec(key, "AES");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(128, iv));
        byte[] ciphertext = cipher.doFinal("hello".getBytes());

        ChatSendDto dto = new ChatSendDto();
        dto.setMessageId("m1");
        dto.setType(MessageType.TEXT);
        dto.setE2ee(true);
        dto.setAlgo("AES-GCM");
        dto.setIv(iv);
        dto.setCiphertext(ciphertext);
        dto.setKeyRef("k1");

        ChatMessage saved = messageService.saveInbound(99L, 1L, dto);

        assertTrue(saved.isE2ee());
        assertNull(saved.getBody());
        assertArrayEquals(ciphertext, saved.getCiphertext());
        assertArrayEquals(iv, saved.getIv());
        assertEquals("AES-GCM", saved.getAlgo());
    }
}
