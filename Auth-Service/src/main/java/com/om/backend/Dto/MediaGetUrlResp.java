package com.om.backend.Dto;

import java.time.Instant;
public record MediaGetUrlResp(String getUrl, Instant expiresAt) {}
