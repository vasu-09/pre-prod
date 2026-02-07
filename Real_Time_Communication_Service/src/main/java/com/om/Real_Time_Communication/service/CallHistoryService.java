package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.CallSessionRepository;
import com.om.Real_Time_Communication.dto.CallSummaryDto;

import com.om.Real_Time_Communication.models.CallSession;
import com.om.Real_Time_Communication.models.CallState;
import com.om.Real_Time_Communication.utility.CsvIds;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service

public class CallHistoryService {

    private final CallSessionRepository repo;


    public CallHistoryService(CallSessionRepository repo) {
        this.repo = repo;
    }

    public Page<CallSummaryDto> getHistory(Long userId,
                                           Long roomId,
                                           CallState state,
                                           java.time.Instant since,
                                           java.time.Instant until,
                                           int page, int size, String sort) {
        Sort s = (sort == null || sort.isEmpty())
                ? Sort.by(Sort.Direction.DESC, "createdAt")
                : Sort.by(Sort.Direction.DESC, sort);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size), s);

        Page<CallSession> result = repo.searchHistory(userId, roomId, state, since, until, pageable);
        return result.map(this::toDto);
    }

    private CallSummaryDto toDto(CallSession c) {
        List<Long> participants = new ArrayList<Long>();
        participants.add(c.getInitiatorId());
        participants.addAll(CsvIds.parse(c.getCalleeIdsCsv()));

        return new CallSummaryDto(
                c.getId(),
                c.getRoomId(),
                c.getInitiatorId(),
                participants,
                c.getState(),
                c.getTopology(),
                c.getCreatedAt(),
                c.getAnsweredAt(),
                c.getEndedAt(),
                c.isE2ee(),
                c.getE2eeVer(),
                c.getE2eeKeyRef(),
                c.getE2eeAlgo()
        );
    }
}
