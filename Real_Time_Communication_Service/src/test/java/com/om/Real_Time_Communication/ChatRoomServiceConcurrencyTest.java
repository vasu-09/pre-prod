package com.om.Real_Time_Communication;

import com.om.Real_Time_Communication.Repository.ChatRoomRepository;
import com.om.Real_Time_Communication.client.UserServiceClient;
import com.om.Real_Time_Communication.models.ChatRoom;
import com.om.Real_Time_Communication.models.ChatRoomType;
import com.om.Real_Time_Communication.service.ChatRoomService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.TestPropertySource;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@DataJpaTest
@Import(ChatRoomService.class)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:rtc-test;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ChatRoomServiceConcurrencyTest {

    @Autowired
    private ChatRoomService chatRoomService;

    @Autowired
    private ChatRoomRepository chatRoomRepository;

    @MockitoBean
    private UserServiceClient userServiceClient;

    @AfterEach
    void cleanUp() {
        chatRoomRepository.deleteAll();
    }

    @Test
    void createDirectChat_isIdempotentUnderConcurrency() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);

        Callable<ChatRoom> firstCall = () -> chatRoomService.createDirectChat(5L, 6L);
        Callable<ChatRoom> secondCall = () -> chatRoomService.createDirectChat(6L, 5L);

        Future<ChatRoom> result1 = executor.submit(firstCall);
        Future<ChatRoom> result2 = executor.submit(secondCall);

        ChatRoom room1 = getRoom(result1);
        ChatRoom room2 = getRoom(result2);

        executor.shutdown();
        executor.awaitTermination(5, TimeUnit.SECONDS);

        assertNotNull(room1.getId());
        assertEquals(room1.getId(), room2.getId());
        assertEquals(ChatRoomRepository.buildDirectPairKey(5L, 6L), room1.getDirectPairKey());
        assertEquals(ChatRoomType.DIRECT, room1.getType());
        assertEquals(1, chatRoomRepository.count());
    }

    private ChatRoom getRoom(Future<ChatRoom> future) throws ExecutionException, InterruptedException {
        return future.get();
    }
}
