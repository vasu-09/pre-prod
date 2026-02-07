package com.om.To_Do.List.ecosystem.model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity

public class Payment1 {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String orderId1; // Razorpay's order ID
    private String paymentId; // Razorpay's payment ID
    private double amount;
    private String status; // "success", "failed", etc.
    private String method;

    public Payment1() {
    }

    public Payment1(Long id, String orderId1, String paymentId, double amount, String status, String method) {
        this.id = id;
        this.orderId1 = orderId1;
        this.paymentId = paymentId;
        this.amount = amount;
        this.status = status;
        this.method = method;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getOrderId1() {
        return orderId1;
    }

    public void setOrderId1(String orderId1) {
        this.orderId1 = orderId1;
    }

    public String getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(String paymentId) {
        this.paymentId = paymentId;
    }

    public double getAmount() {
        return amount;
    }

    public void setAmount(double amount) {
        this.amount = amount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }
}
