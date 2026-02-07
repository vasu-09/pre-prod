# ===== Build stage ====
FROM maven:3.9.9-eclipse-temurin-21 AS builder

WORKDIR /workspace

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

# ===== Runtime stage =====
FROM eclipse-temurin:21-jre

WORKDIR /app

# Adjust jar name to match your project artifactId
COPY --from=builder /workspace/target/*.jar app.jar

# Spring Boot to-do port = 8090
EXPOSE 8090

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
