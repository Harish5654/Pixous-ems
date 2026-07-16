# syntax=docker/dockerfile:1

# ---- Build stage -------------------------------------------------------------
# The project has no Maven wrapper, so build inside a Maven image.
# Java source level is 17; JDK 21 compiles and runs it fine.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Cache dependencies first (only re-downloads when pom.xml changes).
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

# Build the executable jar (skip tests — they need a live MySQL).
COPY src ./src
RUN mvn -B -q clean package -DskipTests

# ---- Runtime stage -----------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# Run as a non-root user.
RUN addgroup -S app && adduser -S app -G app
USER app

# The Spring Boot repackage produces exactly one *.jar (the *.jar.original
# backup does not match this glob).
COPY --from=build /app/target/*.jar app.jar

# Render injects PORT (default 10000); fall back to 7060 for local runs.
ENV PORT=7060
# Keep the JVM inside the 512 MB free-tier container.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70.0 -XX:+UseSerialGC"

EXPOSE 7060
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar --server.port=${PORT}"]
