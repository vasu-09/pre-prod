package com.om.Real_Time_Communication.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class CallInviteDto {
    private List<Long> calleeIds;
    private boolean e2ee;
    private Short e2eeVer;
    private String e2eeKeyRef;
    private String e2eeAlgo;
}
