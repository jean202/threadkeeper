package com.jean325.threadkeeper.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;

    // Both spellings of loopback: the browser's origin is whichever one the user
    // typed, and http://127.0.0.1:3000 is otherwise rejected as cross-origin.
    public WebConfig(
            @Value("${threadkeeper.web.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}")
            String allowedOrigins
    ) {
        this.allowedOrigins = allowedOrigins.split(",");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
