package com.jean325.threadkeeper.global.config;

import com.jean325.threadkeeper.provider.application.ImportSchedulerProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ImportSchedulerProperties.class)
public class ImportSchedulerConfig {
}
