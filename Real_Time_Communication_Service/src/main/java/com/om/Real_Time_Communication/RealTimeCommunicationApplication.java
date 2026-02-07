package com.om.Real_Time_Communication;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;

@SpringBootApplication
@EnableRabbit
@EnableScheduling
@EnableFeignClients(basePackages = "com.om.Real_Time_Communication.client")
public class RealTimeCommunicationApplication {

	public static void main(String[] args) {
		SpringApplication.run(RealTimeCommunicationApplication.class, args);
	}

}
