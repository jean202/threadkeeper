package com.jean325.threadkeeper.global.config;

import com.jean325.threadkeeper.portfolio.domain.PortfolioProperties;
import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(PortfolioProperties.class)
public class PortfolioConfig {

    @Bean
    public Clock portfolioClock() {
        return Clock.systemUTC();
    }
}
