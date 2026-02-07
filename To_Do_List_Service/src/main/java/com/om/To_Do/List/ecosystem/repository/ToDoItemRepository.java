package com.om.To_Do.List.ecosystem.repository;

import com.om.To_Do.List.ecosystem.model.ToDoItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;


@Repository
public interface ToDoItemRepository extends JpaRepository<ToDoItem, Long> {
    @Modifying
    @Query("DELETE FROM ToDoItem t WHERE t.list.id = :listId")
    void deleteByListId(@Param("listId") Long listId);

     List<ToDoItem> findByListId(Long listId);

    List<ToDoItem> findByListIdAndUpdatedAtAfter(Long listId, LocalDateTime updatedAt);
}
