package com.om.Real_Time_Communication.dto;

// imports:
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.Instant;
import java.util.List;

@Setter
@Getter
@Data
@Document(indexName = SearchMessageDoc.INDEX)
public class SearchMessageDoc {
    public static final String INDEX = "rtc_messages";

    @Id
    private String messageId;

    @Field(type = FieldType.Keyword) private String tenant;
    @Field(type = FieldType.Long)    private Long roomId;
    @Field(type = FieldType.Long)    private Long senderId;
    @Field(type = FieldType.Keyword) private String type;
    @Field(type = FieldType.Date)    private java.time.Instant createdAt;

    @Field(type = FieldType.Text, analyzer = "standard", searchAnalyzer = "standard")
    private String text;

    @Field(type = FieldType.Keyword) private java.util.List<String> participants;
    @Field(type = FieldType.Keyword) private String visibility;

    // getters/setters …


    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public String getTenant() {
        return tenant;
    }

    public void setTenant(String tenant) {
        this.tenant = tenant;
    }

    public Long getRoomId() {
        return roomId;
    }

    public void setRoomId(Long roomId) {
        this.roomId = roomId;
    }

    public Long getSenderId() {
        return senderId;
    }

    public void setSenderId(Long senderId) {
        this.senderId = senderId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public List<String> getParticipants() {
        return participants;
    }

    public void setParticipants(List<String> participants) {
        this.participants = participants;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public static SearchMessageDoc from(MessageCreated ev) {
        SearchMessageDoc d = new SearchMessageDoc();
        d.setMessageId(ev.messageId);
        d.setRoomId(ev.roomId);
        d.setSenderId(ev.senderId);
        d.setType(ev.type);
        d.setCreatedAt(ev.serverTs);
        d.setVisibility("private");
        if (!ev.e2ee) d.setText(ev.body);
        return d;
    }
}
