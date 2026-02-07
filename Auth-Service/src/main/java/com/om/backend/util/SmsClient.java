package com.om.backend.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.om.backend.Config.SmsProperties;
import com.om.backend.Dto.SendSmsRequest;
import com.om.backend.Dto.SendSmsResponse;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
@RequiredArgsConstructor
public class SmsClient {

    @Autowired
    private WebClient smsWebClient;
    @Autowired
    private SmsProperties props;

    @Autowired
    private ObjectMapper objectMapper;

    private static final Logger log = LoggerFactory.getLogger(SmsClient.class);

    public SendSmsResponse sendOtpMessage(String message, String e164Mobile, boolean requestDlr) {

        SendSmsRequest req = new SendSmsRequest(
                props.getApiKey(),
                props.getClientId(),
                props.getSenderId(),
                message,
                e164Mobile
        );
        try { log.info("MySMSMantra request ({}) : {}", objectMapper.writeValueAsString(req)); } catch (Exception ignore) {}

        return smsWebClient.post()
                .uri("/SendSMS")
                .body(BodyInserters.fromValue(req))
                .retrieve()
                .bodyToMono(SendSmsResponse.class)
                .onErrorResume(ex -> {
                    SendSmsResponse r = new SendSmsResponse();
                    r.setErrorCode(-1);
                    r.setErrorDescription(ex.getMessage());
                    return Mono.just(r);
                })
                .block();
    }


}