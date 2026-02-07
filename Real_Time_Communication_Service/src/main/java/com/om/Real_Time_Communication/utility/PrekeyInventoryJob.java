package com.om.Real_Time_Communication.utility;

import com.om.Real_Time_Communication.Repository.E2eeDeviceRepository;
import com.om.Real_Time_Communication.Repository.E2eeOneTimePrekeyRepository;
import com.om.Real_Time_Communication.models.E2eeDevice;
import org.slf4j.Logger; import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class PrekeyInventoryJob {
    private static final Logger log = LoggerFactory.getLogger(PrekeyInventoryJob.class);

    private final E2eeDeviceRepository devRepo;
    private final E2eeOneTimePrekeyRepository preRepo;

    public PrekeyInventoryJob(E2eeDeviceRepository devRepo, E2eeOneTimePrekeyRepository preRepo) {
        this.devRepo = devRepo; this.preRepo = preRepo;
    }

    @Scheduled(cron = "0 */15 * * * *") // every 15 minutes
    public void check() {
        List<E2eeDevice> devices = devRepo.findAll();
        for (var d : devices) {
            long stock = preRepo.countByUserIdAndDeviceIdAndConsumedFalse(d.getUserId(), d.getDeviceId());
            if (stock < 20) {
                log.info("E2EE OTK low stock: user={} device={} stock={}", d.getUserId(), d.getDeviceId(), stock);
                // TODO: push a silent notification prompting client to upload more prekeys.
            }
        }
    }
}
