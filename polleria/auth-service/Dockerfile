FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /workspace
COPY pom.xml ./
COPY auth-service/pom.xml auth-service/pom.xml
COPY orders-service/pom.xml orders-service/pom.xml
COPY payments-service/pom.xml payments-service/pom.xml
COPY feedback-service/pom.xml feedback-service/pom.xml
COPY finance-service/pom.xml finance-service/pom.xml
COPY incident-service/pom.xml incident-service/pom.xml
COPY facturacion-sunat-service/pom.xml facturacion-sunat-service/pom.xml
COPY auth-service/src auth-service/src
RUN mvn -B -pl auth-service package -DskipTests

FROM eclipse-temurin:21.0.5_11-jre-alpine
RUN addgroup -S spring && adduser -S spring -G spring
WORKDIR /app
COPY --from=builder --chown=spring:spring /workspace/auth-service/target/*.jar app.jar
USER spring:spring
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD sh -c 'nc -z 127.0.0.1 "${PORT:-8081}" || exit 1'
ENTRYPOINT ["java", "-jar", "app.jar"]
