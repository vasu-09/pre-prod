package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.config.MediaQueueConfig;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class MediaJobs {
    private final RabbitTemplate rabbit;


    public MediaJobs(RabbitTemplate rabbit) { this.rabbit = rabbit; }

    public void enqueueProcess(Long mediaId) {
        rabbit.convertAndSend(MediaQueueConfig.EXCHANGE,
                MediaQueueConfig.ROUTING_KEY_PROCESS,
                Map.of("mediaId", mediaId));
    }
}
