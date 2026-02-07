package com.om.Real_Time_Communication.dto;

import com.om.Real_Time_Communication.models.ChatMessage;
import org.springframework.stereotype.Component;

@Component
public class MessageDtoMapper {

    public ChatMessageDto toDto(ChatMessage m) {
        ChatMessageDto d = new ChatMessageDto();
        d.setRoomId(m.getRoomId());
        d.setMessageId(m.getMessageId());
        d.setSenderId(m.getSenderId());
        d.setType(m.getType());
        d.setServerTs(m.getServerTs());
        d.setE2ee(m.isE2ee());
        d.setDeletedBySender(m.isDeletedBySender());
        d.setDeletedByReceiver(m.isDeletedByReceiver());
        d.setDeletedForEveryone(m.isDeletedForEveryone());
        d.setSystemMessage(m.isSystemMessage());
        if (m.isE2ee()) {
            d.setE2eeVer(m.getE2eeVer());
            d.setAlgo(m.getAlgo());
            d.setAad(m.getAad());
            d.setIv(m.getIv());
            d.setCiphertext(m.getCiphertext());
            d.setKeyRef(m.getKeyRef());
        } else {
            d.setBody(m.getBody());
        }
        return d;
    }

    /** Only use this if you accept REST create; for STOMP we already build entity in service. */
    public ChatMessage toEntity(ChatMessageDto d) {
        ChatMessage m = new ChatMessage();
        m.setRoomId(d.getRoomId());
        m.setMessageId(d.getMessageId());
        m.setSenderId(d.getSenderId());
        m.setType(d.getType());
        m.setServerTs(d.getServerTs() != null ? d.getServerTs() : java.time.Instant.now());
        m.setDeletedBySender(d.isDeletedBySender());
        m.setDeletedByReceiver(d.isDeletedByReceiver());
        m.setDeletedForEveryone(d.isDeletedForEveryone());
        m.setSystemMessage(d.isSystemMessage());
        m.setE2ee(d.isE2ee());
        if (d.isE2ee()) {
            m.setE2eeVer(d.getE2eeVer());
            m.setAlgo(d.getAlgo());
            m.setAad(d.getAad());
            m.setIv(d.getIv());
            m.setCiphertext(d.getCiphertext());
            m.setKeyRef(d.getKeyRef());
        } else {
            m.setBody(d.getBody());
        }
        return m;
    }
}
