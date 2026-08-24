# Stage 1: Build
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copiar POMs para aprovechar caché de dependencias
COPY pom.xml .
COPY auth-service/pom.xml auth-service/
COPY orders-service/pom.xml orders-service/
COPY payments-service/pom.xml payments-service/

# Copiar código fuente de orders-service
COPY orders-service/src orders-service/src

# Compilar solo el módulo orders-service y sus dependencias
RUN mvn -B clean package -pl orders-service -am -DskipTests

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/orders-service/target/*.jar app.jar

EXPOSE 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
