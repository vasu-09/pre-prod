package com.om.Real_Time_Communication.models;

import jakarta.persistence.*;

import java.time.Instant;

// Media.java (JPA)
@Entity
@Table(name="media")
public class Media {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long ownerUserId;
    private String roomId;          // optional, for access checks
    private String contentType;     // "image/jpeg", "video/mp4"
    private Long sizeBytes;

    private String gcsBucket;       // where it lives
    private String gcsObject;       // path (e.g., uploads/2025/08/12/ULID-original)

    private String status;          // "CREATED","UPLOADING","UPLOADED","PROCESSING","READY","FAILED"
    private Instant createdAt;
    private Instant updatedAt;

    // Derivatives (nullable)
    private String thumbObject;     // e.g., thumbs/..../ULID-320.jpg
    private String transcodeObject; // for video: h264 mp4 path
    private Integer width;
    private Integer height;
    private Long durationMs;        // for video
    // getters/setters…


    public Media() {
    }

    public Media(Long id, Long ownerUserId, String roomId, String contentType, Long sizeBytes, String gcsBucket, String gcsObject, String status, Instant createdAt, Instant updatedAt, String thumbObject, String transcodeObject, Integer width, Integer height, Long durationMs) {
        this.id = id;
        this.ownerUserId = ownerUserId;
        this.roomId = roomId;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.gcsBucket = gcsBucket;
        this.gcsObject = gcsObject;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.thumbObject = thumbObject;
        this.transcodeObject = transcodeObject;
        this.width = width;
        this.height = height;
        this.durationMs = durationMs;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getOwnerUserId() {
        return ownerUserId;
    }

    public void setOwnerUserId(Long ownerUserId) {
        this.ownerUserId = ownerUserId;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public String getGcsBucket() {
        return gcsBucket;
    }

    public void setGcsBucket(String gcsBucket) {
        this.gcsBucket = gcsBucket;
    }

    public String getGcsObject() {
        return gcsObject;
    }

    public void setGcsObject(String gcsObject) {
        this.gcsObject = gcsObject;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getThumbObject() {
        return thumbObject;
    }

    public void setThumbObject(String thumbObject) {
        this.thumbObject = thumbObject;
    }

    public String getTranscodeObject() {
        return transcodeObject;
    }

    public void setTranscodeObject(String transcodeObject) {
        this.transcodeObject = transcodeObject;
    }

    public Integer getWidth() {
        return width;
    }

    public void setWidth(Integer width) {
        this.width = width;
    }

    public Integer getHeight() {
        return height;
    }

    public void setHeight(Integer height) {
        this.height = height;
    }

    public Long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(Long durationMs) {
        this.durationMs = durationMs;
    }
}

