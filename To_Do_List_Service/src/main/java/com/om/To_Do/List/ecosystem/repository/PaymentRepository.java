package com.om.To_Do.List.ecosystem.repository;

import com.om.To_Do.List.ecosystem.model.Payment1;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PaymentRepository extends JpaRepository<Payment1, Long> {
}
