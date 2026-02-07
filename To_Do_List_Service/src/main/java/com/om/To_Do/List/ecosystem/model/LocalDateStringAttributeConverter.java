package com.om.To_Do.List.ecosystem.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.time.LocalDate;

/**
 * Converts {@link LocalDate} values to ISO-8601 strings for persistence and vice-versa.
 *
 * <p>
 * The existing database stores subscription dates in VARCHAR columns. Hibernate
 * therefore receives {@code java.sql.String} values when reading rows, which it
 * cannot coerce to {@link LocalDate} automatically. This converter bridges the
 * gap by serializing dates as ISO strings in the database while exposing
 * type-safe {@code LocalDate} fields in the entity.
 * </p>
 */
@Converter(autoApply = false)
public class LocalDateStringAttributeConverter implements AttributeConverter<LocalDate, String> {

    @Override
    public String convertToDatabaseColumn(LocalDate attribute) {
        return attribute == null ? null : attribute.toString();
    }

    @Override
    public LocalDate convertToEntityAttribute(String dbData) {
        return (dbData == null || dbData.isBlank()) ? null : LocalDate.parse(dbData);
    }
}
