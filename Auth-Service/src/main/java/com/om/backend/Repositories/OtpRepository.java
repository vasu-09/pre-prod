package com.om.backend.Repositories;

import com.om.backend.Model.Otp;
import org.apache.el.stream.Stream;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface OtpRepository extends JpaRepository<Otp, Long> {
    @Query("SELECT o FROM Otp o WHERE o.phoneNumber = :phoneNumber AND o.expiredAt > :now AND o.isUsed = false ORDER BY o.createdAt DESC")
    Optional<Otp> findValidOtp(@Param("phoneNumber") String phoneNumber, @Param("now") LocalDateTime now);

    Optional<Otp> findByPhoneNumberAndOtpCodeAndIsUsedFalse(String phoneNumber, String otpCode);

    Optional<Otp> findByPhoneNumberAndIsUsedFalse(String phoneNumber);

    Optional<Otp> findByPhoneNumber(String normalized);
}
