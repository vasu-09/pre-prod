package com.om.To_Do.List.ecosystem.repository;

import com.om.To_Do.List.ecosystem.model.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {
    @Modifying
    @Query("UPDATE Subscription s " +
            "SET s.failureCount = s.failureCount + 1, " +
            "    s.lastFailureAt = :ts " +
            "WHERE s.userId = :userId")
    void incrementFailureCount(Long userId, LocalDateTime ts);

    @Modifying
    @Query("UPDATE Subscription s " +
            "SET s.isActive = false " +
            "WHERE s.userId = :userId")
    void markInactive(Long userId);

    Optional<Subscription> findByUserId(Long userId);

    Optional<Subscription> findBySubscriptionId(String subscriptionId);
}
