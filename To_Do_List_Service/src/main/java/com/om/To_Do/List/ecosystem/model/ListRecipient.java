package com.om.To_Do.List.ecosystem.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Data
@Builder
@ToString(exclude = "list")
@Table(name = "list_recipients")
public class ListRecipient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long recipientUserId;

    @ManyToOne
    @JoinColumn(name = "list_id")
    @JsonIgnore
    private ToDoList list;


    public ListRecipient() {
    }

    public ListRecipient(Long id, Long recipientUserId, ToDoList list) {
        this.id = id;
        this.recipientUserId = recipientUserId;
        this.list = list;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getRecipientUserId() {
        return recipientUserId;
    }

    public void setRecipientUserId(Long recipientUserId) {
        this.recipientUserId = recipientUserId;
    }

    public ToDoList getList() {
        return list;
    }

    public void setList(ToDoList list) {
        this.list = list;
    }
}

