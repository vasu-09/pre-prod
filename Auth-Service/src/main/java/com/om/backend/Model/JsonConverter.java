package com.om.backend.Model;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;

public abstract class JsonConverter<T> implements AttributeConverter<T, String> {
    private static final ObjectMapper M = new ObjectMapper();
    private final Class<T> type;

    protected JsonConverter(Class<T> type) { this.type = type; }

    @Override
    public String convertToDatabaseColumn(T attribute) {
        try {
            return attribute == null ? "{}" : M.writeValueAsString(attribute);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public T convertToEntityAttribute(String dbData) {
        try {
            // null/blank -> empty instance
            if (dbData == null || dbData.isBlank()) {
                return type.getDeclaredConstructor().newInstance();
            }

            String s = dbData.trim();

            // If DB handed us a JSON *string literal* (double-encoded), first decode to raw JSON text
            // Example: "\"{\\\"messages\\\":{\\\"enabled\\\":false}}\""  ->  "{\"messages\":{\"enabled\":false}}"
            if (s.length() >= 2 && s.charAt(0) == '"' && s.charAt(s.length() - 1) == '"') {
                s = M.readValue(s, String.class); // removes outer quotes & unescapes
            }

            // If some driver/wrapper returned single-quoted JSON, strip the quotes
            if (s.length() >= 2 && s.charAt(0) == '\'' && s.charAt(s.length() - 1) == '\'') {
                s = s.substring(1, s.length() - 1);
            }

            // Final parse into the target type
            return M.readValue(s, type);

        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse JSON for " + type.getSimpleName(), e);
        }
    }
}
