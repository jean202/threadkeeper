package com.jean325.threadkeeper.global.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Provides the single application {@link Clock} bean. Kept in a neutral config (not tied to any
 * one feature) because multiple features inject it for testable time handling.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
