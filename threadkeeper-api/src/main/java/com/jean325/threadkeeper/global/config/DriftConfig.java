package com.jean325.threadkeeper.global.config;

import com.jean325.threadkeeper.drift.domain.DriftProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(DriftProperties.class)
public class DriftConfig {
}
