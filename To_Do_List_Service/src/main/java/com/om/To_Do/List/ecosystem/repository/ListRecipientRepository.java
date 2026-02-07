package com.om.To_Do.List.ecosystem.repository;

import com.om.To_Do.List.ecosystem.model.ListRecipient;
import com.om.To_Do.List.ecosystem.model.ToDoList;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;


import java.util.List;
import java.util.Optional;


@Repository
public interface ListRecipientRepository extends JpaRepository<ListRecipient, Long> {
    List<ListRecipient> findByListId(Long listId);

    List<ListRecipient> findByListIdAndRecipientUserIdIn(Long listId, List<Long> userIds);

    Optional<ListRecipient> findByListIdAndRecipientUserId(Long listId, Long recipientUserId);

    @Query("""
       SELECT DISTINCT lr.list
       FROM ListRecipient lr
       WHERE lr.recipientUserId IN (:userId1, :userId2)
         AND lr.list.createdByUserId IN (:userId1, :userId2)
         AND lr.recipientUserId <> lr.list.createdByUserId
       """)
    List<ToDoList> findListsSharedBetween(@Param("userId1") Long userId1,
                                          @Param("userId2") Long userId2);


    @Query("""
        SELECT lr.list
        FROM ListRecipient lr
        WHERE lr.list.id = :listId
          AND (
                  (lr.list.createdByUserId = :userId AND lr.recipientUserId = :peerId) OR
                  (lr.list.createdByUserId = :peerId AND lr.recipientUserId = :userId)
                )
        """)
    Optional<ToDoList> findSharedListBetweenUsers(@Param("listId") Long listId,
                                                  @Param("userId") Long userId,
                                                  @Param("peerId") Long peerId);
    @Query("""
    SELECT lr.recipientUserId
    FROM ListRecipient lr
    WHERE lr.list.id = :listId
      AND lr.list.createdByUserId = :creatorId
    """)
    List<Long> findRecipientIdsByListIdAndCreatorId(@Param("listId") Long listId, @Param("creatorId") Long creatorId);



}
