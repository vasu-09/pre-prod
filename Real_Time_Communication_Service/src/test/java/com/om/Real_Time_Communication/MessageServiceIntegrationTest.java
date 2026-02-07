package com.om.Real_Time_Communication;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.om.Real_Time_Communication.Repository.*;
import com.om.Real_Time_Communication.dto.MessageDto;
import com.om.Real_Time_Communication.models.Message;
import com.om.Real_Time_Communication.models.MessageType;
import com.om.Real_Time_Communication.security.SessionRegistry;
import com.om.Real_Time_Communication.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.om.Real_Time_Communication.client.UserServiceClient;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@DataJpaTest
@Import({MessageService.class, MessageServiceIntegrationTest.Config.class})
class MessageServiceIntegrationTest {

    @TestConfiguration
    static class Config {
        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }

        @Bean
        BlockService blockService() {
            return mock(BlockService.class);
        }

        @Bean
        EventPublisher eventPublisher() {
            return mock(EventPublisher.class);
        }

        @Bean
        SimpMessagingTemplate messagingTemplate() {
            return mock(SimpMessagingTemplate.class);
        }

        @Bean
        MessageService.DirectRoomPolicy directPolicy() {
            return mock(MessageService.DirectRoomPolicy.class);
        }

        @Bean
        RoomMembershipService membership() {
            return mock(RoomMembershipService.class);
        }

        @Bean
        SessionRegistry sessionRegistry() {
            return new SessionRegistry();
        }

        @Bean
        PendingMessageService pendingMessageService() {
            return mock(PendingMessageService.class);
        }

        @Bean
        UndeliveredMessageStore undeliveredMessageStore() {
            return mock(UndeliveredMessageStore.class);
        }

        @Bean
        InboxDeliveryService inboxDeliveryService() {
            return mock(InboxDeliveryService.class);
        }
    }

    @MockitoBean
    ChatRoomService aclService;

    @MockitoBean
    UserServiceClient userServiceClient;

    @Autowired
    MessageService messageService;

    @Autowired
    MessageRepository messageRepository;

    @Autowired
    BlockService blockService;

    @BeforeEach
    void setup() {
        when(blockService.isBlocked(anyString(), anyString())).thenReturn(false);
    }

    @Test
    void concurrentPrivateMessagesPersistAndOrder() throws Exception {
        int threads = 5;
        int perThread = 20;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(threads * perThread);

        for (int i = 0; i < threads; i++) {
            int sender = i;
            pool.submit(() -> {
                for (int j = 0; j < perThread; j++) {
                    MessageDto dto = new MessageDto();
                    dto.setSenderId("s" + sender);
                    dto.setReceiverId("1");
                    dto.setContent("m" + sender + "-" + j);
                    dto.setType(MessageType.TEXT);
                    dto.setMessageId("m-" + sender + "-" + j);
                    try {
                        messageService.handlePrivateMessage(dto);
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                    latch.countDown();
                }
            });
        }

        latch.await(10, TimeUnit.SECONDS);
        pool.shutdown();

        List<Message> all = messageRepository.findAll(org.springframework.data.domain.Sort.by("timestamp"));
        assertThat(all).hasSize(threads * perThread);

        for (int i = 1; i < all.size(); i++) {
            assertThat(!all.get(i - 1).getTimestamp().isAfter(all.get(i).getTimestamp())).isTrue();
        }
    }
}
