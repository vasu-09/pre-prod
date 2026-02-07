package com.om.backend.Repositories;

import com.om.backend.Model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.security.core.parameters.P;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByPhoneNumber(String phoneNumber);

    @Query(value = "SELECT u.id FROM users u WHERE u.phone_number IN (:phoneNumbers)", nativeQuery = true)
    List<Long> findIdsByPhoneNumbers(@Param("phoneNumbers") List<String> phoneNumbers);

    @Query(value = "SELECT u.id FROM users u WHERE u.phone_number = :phoneNumber", nativeQuery = true)
    Long findUserIdByPhoneNumber(@Param("phoneNumber") String phoneNumber);
    @Query(value = "SELECT u.phone_number FROM users u WHERE u.id = :id", nativeQuery = true)
    String findPhoneNumberByuserID(@Param("id") Long id);
    @Query(value = "SELECT u.phone_number FROM users u WHERE u.id IN (:id)", nativeQuery = true)
    List<String> findPhoneNumbersByIds(@Param("id") List<Long> id);

    List<User> findByPhoneNumberIn(List<String> e164Phones);


}
