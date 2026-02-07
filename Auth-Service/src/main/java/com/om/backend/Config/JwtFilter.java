package com.om.backend.Config;


import com.om.backend.services.JWTService;

import com.om.backend.services.OtpService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtFilter extends OncePerRequestFilter {

    @Autowired
    private JWTService jwtService;

    private static final Logger log = LoggerFactory.getLogger(JwtFilter.class);

    private static final List<String> PUBLIC_PATHS = List.of(
            "/.well-known/jwks.json",
            "/.well-known/openid-configuration",
            "/auth/otp/send",
            "/auth/otp/verify"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = resolveToken(request);
        String sub = null; // holds the JWT subject (user id)

        log.info("authorization token resolved from headers/query={} for {} {}",
                token == null ? "<missing>" : "<present>", request.getMethod(), request.getRequestURI());
        if (token != null) {
            sub = jwtService.extractPhonenumber(token); // subject = userId

        }
        // Previously we loaded the user by phone number. However our tokens use the
        // user id as the subject, which caused lookups to fail and every request to
        // be rejected with 403. Instead, simply trust the verified JWT claims and
        // authenticate with the user id extracted from the token.
        if (sub != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            // ensure token is valid (signature + not expired)
            if (!jwtService.isTokenExpired(token)) {
                UsernamePasswordAuthenticationToken authentoken =
                        new UsernamePasswordAuthenticationToken(sub, token, List.of());
                authentoken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentoken);
            }
        }
        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return PUBLIC_PATHS.contains(path);
    }

    private static String resolveToken(HttpServletRequest request) {
        // 1) Authorization: Bearer <token>
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null) {
            String trimmed = authHeader.trim();
            if (trimmed.regionMatches(true, 0, "bearer ", 0, 7)) {
                return trimmed.substring(7).trim();
            }
            String[] parts = trimmed.split(",");
            for (int i = 0; i < parts.length - 1; i++) {
                if (parts[i].trim().equalsIgnoreCase("bearer")) {
                    String candidate = parts[i + 1].trim();
                    if (!candidate.isBlank()) {
                        return candidate;
                    }
                }
            }
        }

        // 2) Sec-WebSocket-Protocol: bearer <token> or bearer,<token>
        var protocols = request.getHeaders("Sec-WebSocket-Protocol");
        while (protocols.hasMoreElements()) {
            String header = protocols.nextElement();
            for (String part : header.split(",")) {
                String trimmed = part.trim();
                if (trimmed.regionMatches(true, 0, "bearer ", 0, 7)) {
                    String candidate = trimmed.substring(7).trim();
                    if (!candidate.isBlank()) {
                        return candidate;
                    }
                }
            }
            // look for the "bearer,<token>" pattern
            String[] parts = header.split(",");
            for (int i = 0; i < parts.length - 1; i++) {
                if (parts[i].trim().equalsIgnoreCase("bearer")) {
                    String candidate = parts[i + 1].trim();
                    if (!candidate.isBlank()) {
                        return candidate;
                    }
                }
            }
        }

        // 3) Query string: access_token or token
        String queryToken = request.getParameter("access_token");
        if (queryToken == null || queryToken.isBlank()) {
            queryToken = request.getParameter("token");
        }
        return queryToken != null && !queryToken.isBlank() ? queryToken.trim() : null;
    }
}
