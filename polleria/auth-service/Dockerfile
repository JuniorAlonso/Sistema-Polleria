# Stage 1: Build
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copiar POMs para aprovechar caché de dependencias
COPY pom.xml .
COPY auth-service/pom.xml auth-service/
COPY orders-service/pom.xml orders-service/
COPY payments-service/pom.xml payments-service/

# Copiar código fuente de auth-service
COPY auth-service/src auth-service/src

# Compilar solo el módulo auth-service y sus dependencias
RUN mvn -B clean package -pl auth-service -am -DskipTests

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/auth-service/target/*.jar app.jar

EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
