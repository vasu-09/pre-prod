package com.om.backend.Repositories;

import com.om.backend.Model.UserChatPrefs;
import com.om.backend.Model.UserChatPrefs.Key;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserChatPrefsRepository extends JpaRepository<UserChatPrefs, Key> {
    Optional<UserChatPrefs> findByUserIdAndChatId(Long userId, Long chatId);
    long deleteByUserIdAndChatId(Long userId, Long chatId);
}
