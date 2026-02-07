package com.om.To_Do.List.ecosystem.model;


import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Data
@Builder
@ToString(exclude = {"items", "recipients"})
@Table(name = "todo_lists")
public class ToDoList {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long createdByUserId; // usually the vendor

    private String title;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Enumerated(EnumType.STRING)
    private ListType listType;

    @OneToMany(mappedBy = "list", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ToDoItem> items;
    
    @OneToMany(mappedBy = "list", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ListRecipient> recipients;

    @Column(nullable = false)
    private boolean pinned = false;


    public ToDoList() {
    }

    public ToDoList(Long id, Long createdByUserId, String title, LocalDateTime createdAt, LocalDateTime updatedAt,
                    ListType listType, List<ToDoItem> items, List<ListRecipient> recipients, boolean pinned) {
        this.id = id;
        this.createdByUserId = createdByUserId;
        this.title = title;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.listType = listType;
        this.items = items;
        this.recipients = recipients;
         this.pinned = pinned;
    }


    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(Long createdByUserId) {
        this.createdByUserId = createdByUserId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public ListType getListType() {
        return listType;
    }

    public void setListType(ListType listType) {
        this.listType = listType;
    }

    public List<ToDoItem> getItems() {
        return items;
    }

    public void setItems(List<ToDoItem> items) {
    this.items =items;
}

    public List<ListRecipient> getRecipients() {
        return recipients;
    }

    public void setRecipients(List<ListRecipient> recipients) {
       this.recipients=recipients;
    }

     public boolean isPinned() {
        return pinned;
    }

    public void setPinned(boolean pinned) {
        this.pinned = pinned;
    }
}

