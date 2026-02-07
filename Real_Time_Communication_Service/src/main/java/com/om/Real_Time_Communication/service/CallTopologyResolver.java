package com.om.Real_Time_Communication.service;

import org.springframework.stereotype.Service;

@Service
public class CallTopologyResolver {
    public String topologyForParticipants(int count) {
        return count <= 2 ? "P2P" : "SFU";
    }
}
