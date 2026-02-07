package com.om.Real_Time_Communication.utility;

import com.om.Real_Time_Communication.dto.SearchMessageDoc;

public interface SearchWriter {
    void enqueue(SearchMessageDoc doc); // fire-and-forget
}
