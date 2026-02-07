package com.om.Real_Time_Communication.models;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "outbox_event", indexes = {
        @Index(name="ix_outbox_status_time", columnList = "status,occurred_at")
})
public class OutboxEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="aggregate_type", nullable=false, length=50)
    private String aggregateType;

    @Column(name="aggregate_id", nullable=false)
    private Long aggregateId;

    @Column(name="event_type", nullable=false, length=50)
    private String eventType;

    @Lob @Column(name="payload", nullable=false, columnDefinition = "JSON")
    private String payload;  // JSON string

    @Column(name="occurred_at", nullable=false)
    private Instant occurredAt = Instant.now();

    @Column(name="published_at")
    private Instant publishedAt;

    @Column(name="status", nullable=false, length=20)
    private String status = "PENDING"; // PENDING|SENT|FAILED

    @Column(name="attempts", nullable=false)
    private int attempts = 0;

    // getters/setters
    public Long getId() { return id; }
    public String getAggregateType() { return aggregateType; }
    public void setAggregateType(String aggregateType) { this.aggregateType = aggregateType; }
    public Long getAggregateId() { return aggregateId; }
    public void setAggregateId(Long aggregateId) { this.aggregateId = aggregateId; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }
    public Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
}