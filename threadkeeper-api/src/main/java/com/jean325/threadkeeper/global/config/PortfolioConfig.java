package com.jean325.threadkeeper.global.config;

import com.jean325.threadkeeper.portfolio.domain.PortfolioProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(PortfolioProperties.class)
public class PortfolioConfig {
}
