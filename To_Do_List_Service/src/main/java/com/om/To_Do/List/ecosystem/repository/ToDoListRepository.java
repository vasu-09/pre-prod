package com.om.To_Do.List.ecosystem.repository;

import com.om.To_Do.List.ecosystem.model.ToDoList;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ToDoListRepository extends JpaRepository<ToDoList, Long> {


     List<ToDoList> findByCreatedByUserIdOrderByPinnedDescUpdatedAtDesc(Long userId);

    Optional<ToDoList> findByIdAndCreatedByUserId(Long listId, Long userId);


}
