package com.om.Real_Time_Communication.config;

import com.om.Real_Time_Communication.security.SessionRegistry;
import com.om.Real_Time_Communication.service.PendingMessageService;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory;
import org.springframework.context.annotation.Lazy;

import java.util.Map;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final TaskScheduler brokerTaskScheduler;
    private final StompLoggingInterceptor stompLoggingInterceptor;
    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;
    private final StompSecurityInterceptor stompSecurityInterceptor;
    private final InboundSizeAndRateInterceptor inboundSizeAndRateInterceptor;
    private final OutboundFloodGuardInterceptor outboundFloodGuardInterceptor;
    private final SessionRegistry sessionRegistry;
    private final PendingMessageService pendingMessages;

    public WebSocketConfig(@Qualifier("brokerTaskScheduler") TaskScheduler brokerTaskScheduler,
                           JwtHandshakeInterceptor jwtHandshakeInterceptor,
                           StompSecurityInterceptor stompSecurityInterceptor,
                           StompLoggingInterceptor stompLoggingInterceptor,
                           InboundSizeAndRateInterceptor inboundSizeAndRateInterceptor,
                           OutboundFloodGuardInterceptor outboundFloodGuardInterceptor,
                           SessionRegistry sessionRegistry,
                           @Lazy PendingMessageService pendingMessages) {
        this.brokerTaskScheduler = brokerTaskScheduler;
        this.jwtHandshakeInterceptor = jwtHandshakeInterceptor;
        this.stompSecurityInterceptor = stompSecurityInterceptor;
        this.stompLoggingInterceptor = stompLoggingInterceptor;
        this.inboundSizeAndRateInterceptor = inboundSizeAndRateInterceptor;
        this.outboundFloodGuardInterceptor = outboundFloodGuardInterceptor;
        this.sessionRegistry = sessionRegistry;
        this.pendingMessages = pendingMessages;
    }

    @Value("#{'${cors.allowed-origin-patterns:*}'.split(',')}")
    private String[] allowedOriginPatterns;
    @Value("${rtc.rabbit.stomp.relay.host:}")
    private String relayHost;
    @Value("${rtc.rabbit.stomp.relay.port:61613}")
    private int relayPort;
    @Value("${rtc.rabbit.stomp.client-login:}")
    private String relayClientLogin;
    @Value("${rtc.rabbit.stomp.client-passcode:}")
    private String relayClientPasscode;
    @Value("${rtc.rabbit.stomp.system-login:}")
    private String relaySystemLogin;
    @Value("${rtc.rabbit.stomp.system-passcode:}")
    private String relaySystemPasscode;

    @Bean(name = "brokerTaskScheduler")
    public static TaskScheduler brokerTaskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(4);
        scheduler.setThreadNamePrefix("ws-broker-");
        scheduler.setDaemon(true);
        scheduler.initialize();
        return scheduler;
    }

    @Bean(name = "taskScheduler")
    @Primary
    public static TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("app-sched-");
        scheduler.initialize();
        return scheduler;
    }
    
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setHandshakeHandler(new DefaultHandshakeHandler() {
                    @Override
                    protected java.security.Principal determineUser(ServerHttpRequest request,
                                                                    WebSocketHandler wsHandler,
                                                                    Map<String, Object> attributes) {
                        Object principal = attributes.get("principal");
                        if (principal instanceof java.security.Principal p) {
                            return p;
                        }
                        java.security.Principal fromRequest = request.getPrincipal();
                        if (fromRequest != null) {
                            return fromRequest;
                        }
                        return super.determineUser(request, wsHandler, attributes);
                    }
                })
                .setAllowedOriginPatterns(allowedOriginPatterns)            // tighten in prod
                .addInterceptors(jwtHandshakeInterceptor);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Security/ACLs first, then size/rate guard
        registration.interceptors(stompLoggingInterceptor, stompSecurityInterceptor, inboundSizeAndRateInterceptor);
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        // Backpressure guard on outbound
        registration.interceptors(stompLoggingInterceptor, outboundFloodGuardInterceptor);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration reg) {
        // Transport-level caps
        reg.setMessageSizeLimit(256 * 1024);      // 256KB per inbound STOMP frame
        reg.setSendBufferSizeLimit(512 * 1024);  // 512KB per-session send buffer
        reg.setSendTimeLimit(10_000);            // 10s per send

        // Track opens/closes for duplicate-login policy & server-side kick
        reg.addDecoratorFactory(new WebSocketHandlerDecoratorFactory() {
            @Override
            public WebSocketHandler decorate(WebSocketHandler handler) {
                return new WebSocketHandlerDecorator(handler) {
                    @Override
                    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                        Long uid = (Long) session.getAttributes().get("userId");
                        if (uid != null) {
                            sessionRegistry.onOpen(uid, session);
                            pendingMessages.flush(uid);
                        }
                        super.afterConnectionEstablished(session);
                    }
                    @Override
                    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
                        Long uid = (Long) session.getAttributes().get("userId");
                        sessionRegistry.onClose(session, uid);
                        super.afterConnectionClosed(session, status);
                    }
                };
            }
        });
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        var relay = config.enableStompBrokerRelay("/topic", "/queue") // RabbitMQ STOMP relay
                .setRelayHost(relayHost)
                .setRelayPort(relayPort)
                .setClientLogin(relayClientLogin)
                .setClientPasscode(relayClientPasscode)
                .setSystemLogin(relaySystemLogin)
                .setSystemPasscode(relaySystemPasscode);

        relay.setTaskScheduler(brokerTaskScheduler);
        relay.setSystemHeartbeatSendInterval(10000);
        relay.setSystemHeartbeatReceiveInterval(10000);

        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }
}