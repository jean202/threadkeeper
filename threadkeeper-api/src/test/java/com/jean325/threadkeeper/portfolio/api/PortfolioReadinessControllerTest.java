package com.jean325.threadkeeper.portfolio.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PortfolioReadinessControllerTest {

    @TempDir
    static Path tempDir;

    static Path scanFile;

    @BeforeAll
    static void writeScanFile() throws Exception {
        scanFile = tempDir.resolve("scan.json");
        Files.writeString(scanFile, """
                {"projects":[
                  {"name":"threadkeeper","readiness":82,"baseReadiness":71,"scannedAt":"2026-06-02T22:47:50.883Z"}
                ]}
                """);
    }

    @DynamicPropertySource
    static void portfolioProps(DynamicPropertyRegistry registry) {
        registry.add("threadkeeper.portfolio.enabled", () -> "true");
        registry.add("threadkeeper.portfolio.json-path", () -> scanFile.toString());
        registry.add("threadkeeper.portfolio.stale-max-days", () -> "14");
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void returnsReadinessForProjects() throws Exception {
        mockMvc.perform(get("/api/v1/portfolio-readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].projectKey").value("threadkeeper"))
                .andExpect(jsonPath("$[0].readiness").value(82))
                .andExpect(jsonPath("$[0].baseReadiness").value(71));
    }
}
