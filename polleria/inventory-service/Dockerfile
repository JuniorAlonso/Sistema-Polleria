FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY inventory-service/target/*.jar app.jar
EXPOSE 8086
ENTRYPOINT ["java", "-jar", "app.jar"]
