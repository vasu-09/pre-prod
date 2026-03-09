package com.om.To_Do.List.ecosystem.repository;

import com.om.To_Do.List.ecosystem.model.ProcessedWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcessedWebhookEventRepository extends JpaRepository<ProcessedWebhookEvent, String> {
}