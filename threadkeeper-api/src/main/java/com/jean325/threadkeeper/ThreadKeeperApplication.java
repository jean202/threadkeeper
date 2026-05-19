package com.jean325.threadkeeper;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ThreadKeeperApplication {

    public static void main(String[] args) {
        SpringApplication.run(ThreadKeeperApplication.class, args);
    }
}
