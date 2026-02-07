# ===== Build stage =====
FROM maven:3.9.9-eclipse-temurin-21 AS builder

WORKDIR /workspace

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

# ===== Runtime stage =====
FROM eclipse-temurin:21-jre

WORKDIR /app

# Adjust pattern to your actual jar name (check target/)
COPY --from=builder /workspace/target/*.jar app.jar

# If you didn't set server.port, Boot default is 8080
EXPOSE 8093

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
