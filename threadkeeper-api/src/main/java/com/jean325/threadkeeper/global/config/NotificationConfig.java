package com.jean325.threadkeeper.global.config;

import com.jean325.threadkeeper.notification.domain.NotificationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(NotificationProperties.class)
public class NotificationConfig {
}
