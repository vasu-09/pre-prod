# Multi-stage Dockerfile for Spring Boot Authentication Service

# ---- Build stage ----
FROM maven:3.9.6-eclipse-temurin-21 AS build

WORKDIR /workspace

# Copy pom first for better layer caching
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

# Copy source and build
COPY src ./src
RUN mvn -B -DskipTests package

# ---- Runtime stage ----
FROM eclipse-temurin:21-jre-alpine

# Create non-root user for security
RUN addgroup -S spring && adduser -S spring -G spring

USER spring:spring
WORKDIR /app

# Copy the fat jar from build stage
COPY --from=build /workspace/target/*.jar app.jar

# Expose the port your app runs on (e.g., 8080)
EXPOSE 8092

ENTRYPOINT ["java", "-jar", "/app/app.jar"]

