# ===== Build stage =====
FROM maven:3.9.9-eclipse-temurin-21 AS builder

WORKDIR /workspace

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

# ===== Runtime stage =====
FROM eclipse-temurin:21-jre

WORKDIR /app

# Adjust artifact name if needed
COPY --from=builder /workspace/target/api-gateway-*.jar app.jar

EXPOSE 8080

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
