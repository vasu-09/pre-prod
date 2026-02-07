package com.om.backend.client;

import com.om.backend.Dto.*;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "real-time-communication", url = "${rtc.base-url}")
public interface MediaClient {
    @PostMapping("/api/media/upload-intent")
    MediaUploadIntentResp uploadIntent(@RequestBody MediaUploadIntent req);

    @PostMapping("/api/media/get-url")
    MediaGetUrlResp getUrl(@RequestBody MediaGetUrlReq req);

    @PostMapping("/api/media/head")
    MediaHeadResp head(@RequestBody MediaHeadReq req);
}
