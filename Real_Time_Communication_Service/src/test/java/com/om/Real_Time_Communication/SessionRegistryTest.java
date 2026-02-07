package com.om.Real_Time_Communication;

import com.om.Real_Time_Communication.security.SessionRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.web.socket.*;

import java.net.InetSocketAddress;
import java.net.URI;
import java.security.Principal;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SessionRegistryTest {

    private static class DummySession implements WebSocketSession {
        private final String id;
        private boolean open = true;
        DummySession(String id) { this.id = id; }
        @Override public String getId() { return id; }
        @Override public URI getUri() { return null; }
        @Override public HttpHeaders getHandshakeHeaders() { return new HttpHeaders(); }
        @Override public Map<String, Object> getAttributes() { return new HashMap<>(); }
        @Override public Principal getPrincipal() { return null; }
        @Override public InetSocketAddress getLocalAddress() { return null; }
        @Override public InetSocketAddress getRemoteAddress() { return null; }
        @Override public String getAcceptedProtocol() { return null; }
        @Override public void setTextMessageSizeLimit(int messageSizeLimit) { }
        @Override public int getTextMessageSizeLimit() { return 0; }
        @Override public void setBinaryMessageSizeLimit(int messageSizeLimit) { }
        @Override public int getBinaryMessageSizeLimit() { return 0; }
        @Override public List<WebSocketExtension> getExtensions() { return Collections.emptyList(); }
        @Override public void sendMessage(WebSocketMessage<?> message) { }
        @Override public boolean isOpen() { return open; }
        @Override public void close() { open = false; }
        @Override public void close(CloseStatus status) { open = false; }
    }

    @Test
    void tracksSessionsPerUser() {
        SessionRegistry reg = new SessionRegistry();
        DummySession s1 = new DummySession("s1");
        reg.onOpen(1L, s1);
        assertEquals(1, reg.getSessions(1L).size());
        reg.onClose(s1, 1L);
        assertTrue(reg.getSessions(1L).isEmpty());
    }
}
