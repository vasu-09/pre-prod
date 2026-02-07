package com.om.Real_Time_Communication.utility;

// RtcMetrics.java
import io.micrometer.core.instrument.*;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

@Component
public class RtcMetrics {
    private final AtomicInteger wsConnected = new AtomicInteger();
    private final AtomicInteger sendQueueSize = new AtomicInteger();

    private final Counter msgDropped;
    private final Timer msgPersistLatency;
    private final Gauge gWsConnected;
    private final Gauge gSendQueue;

    public RtcMetrics(MeterRegistry reg) {
        this.gWsConnected = Gauge.builder("ws.connected", wsConnected, AtomicInteger::get).register(reg);
        this.gSendQueue   = Gauge.builder("ws.send.queue.size", sendQueueSize, AtomicInteger::get).register(reg);
        this.msgDropped   = Counter.builder("msg.dropped").register(reg);
        this.msgPersistLatency = Timer.builder("msg.persist.latency")
                .publishPercentileHistogram()
                .sla(Duration.ofMillis(10), Duration.ofMillis(25), Duration.ofMillis(50),
                        Duration.ofMillis(100), Duration.ofMillis(250), Duration.ofMillis(500))
                .register(reg);
    }

    public void onWsOpen(){ wsConnected.incrementAndGet(); }
    public void onWsClose(){ wsConnected.decrementAndGet(); }
    public void setSendQueueSize(int n){ sendQueueSize.set(n); }
    public void dropped(){ msgDropped.increment(); }
    public <T> T timePersist(Supplier<T> s) throws Exception { return msgPersistLatency.recordCallable(s::get); }
}
