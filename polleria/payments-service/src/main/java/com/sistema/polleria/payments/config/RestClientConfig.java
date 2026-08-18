package com.sistema.polleria.payments.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {

    @Value("${orders.service.url}")
    private String ordersServiceUrl;

    @Bean
    public RestClient ordersRestClient() {
        return RestClient.builder()
                .baseUrl(ordersServiceUrl)
                .build();
    }
}
