package com.om.Real_Time_Communication;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.junit.jupiter.api.Disabled;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@Disabled("Context startup requires external services")
class RealTimeCommunicationApplicationTests {

	@Test
	void contextLoads() {
	}

}
