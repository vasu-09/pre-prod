package com.om.To_Do.List.ecosystem.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Data
@Builder
@Table(name = "subscriptions")
public class Subscription {

    @Id
    private Long userId;

    private String subscriptionId;   // Razorpay subscription ID
    // Tokenized payment details for recurring billing
    private String customerId;       // Razorpay customer ID
    private String paymentToken;     // Token/mandate ID returned by Razorpay


    @JsonFormat(pattern = "yyyy-MM-dd")                // for JSON in/out
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)     // for Spring MVC binding
    private LocalDate startDate;

    @JsonFormat(pattern = "yyyy-MM-dd")                // for JSON in/out
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)     // for Spring MVC binding
    private LocalDate expiryDate;
    private Boolean isActive;

    // New fields for failure tracking:
    @Builder.Default
    private Integer failureCount = 0;
    private LocalDateTime lastFailureAt;

    public Subscription() {
    }

    public Subscription(Long userId, String subscriptionId, String customerId, String paymentToken,
                        LocalDate startDate, LocalDate expiryDate, Boolean isActive,
                        Integer failureCount, LocalDateTime lastFailureAt) {
        this.userId = userId;
        this.subscriptionId = subscriptionId;
        this.customerId = customerId;
        this.paymentToken = paymentToken;
        this.startDate = startDate;
        this.expiryDate = expiryDate;
        this.isActive = isActive;
        this.failureCount = failureCount;
        this.lastFailureAt = lastFailureAt;
    }



    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getSubscriptionId() {
        return subscriptionId;
    }

    public void setSubscriptionId(String subscriptionId) {
        this.subscriptionId = subscriptionId;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public String getCustomerId() {
        return customerId;
    }

    public void setCustomerId(String customerId) {
        this.customerId = customerId;
    }

    public String getPaymentToken() {
        return paymentToken;
    }

    public void setPaymentToken(String paymentToken) {
        this.paymentToken = paymentToken;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(LocalDate expiryDate) {
        this.expiryDate = expiryDate;
    }

    public Boolean getActive() {
        return isActive;
    }

    public void setActive(Boolean active) {
        isActive = active;
    }

    public Integer getFailureCount() {
        return failureCount;
    }

    public void setFailureCount(Integer failureCount) {
        this.failureCount = failureCount;
    }

    public LocalDateTime getLastFailureAt() {
        return lastFailureAt;
    }

    public void setLastFailureAt(LocalDateTime lastFailureAt) {
        this.lastFailureAt = lastFailureAt;
    }
}

