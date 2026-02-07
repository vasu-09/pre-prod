package com.om.Real_Time_Communication.utility;

// CorrelationFilter.java
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

@Component
public class CorrelationFilter implements Filter {
    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        Filter.super.init(filterConfig);
    }



    @Override
    public void destroy() {
        Filter.super.destroy();
    }

    private static String firstNonEmpty(String... s){ for (String x: s) if (x!=null && !x.isBlank()) return x; return null; }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
        HttpServletRequest r = (HttpServletRequest) servletRequest;
        String cid = firstNonEmpty(
                r.getHeader("X-Correlation-Id"),
                r.getHeader("traceparent"),
                UUID.randomUUID().toString());
        MDC.put("correlationId", cid);
        try { filterChain.doFilter(servletRequest, servletResponse); }
        finally { MDC.remove("correlationId"); }
    }
}

