package com.jean325.threadkeeper.portfolio.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.portfolio.domain.PortfolioProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class PortfolioScanFileReader {

    private final PortfolioProperties properties;
    private final ObjectMapper objectMapper;

    private long cachedMtime = Long.MIN_VALUE;
    private List<PortfolioScanEntry> cached = List.of();

    public PortfolioScanFileReader(PortfolioProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public synchronized List<PortfolioScanEntry> read() {
        String pathValue = properties.getJsonPath();
        if (pathValue == null || pathValue.isBlank()) {
            return List.of();
        }
        Path path = Path.of(pathValue);
        if (!Files.isRegularFile(path)) {
            cachedMtime = Long.MIN_VALUE;
            cached = List.of();
            return cached;
        }
        try {
            long mtime = Files.getLastModifiedTime(path).toMillis();
            if (mtime == cachedMtime) {
                return cached;
            }
            cached = parse(path);
            cachedMtime = mtime;
            return cached;
        } catch (IOException e) {
            cachedMtime = Long.MIN_VALUE;
            cached = List.of();
            return cached;
        }
    }

    private List<PortfolioScanEntry> parse(Path path) {
        try {
            JsonNode root = objectMapper.readTree(Files.readAllBytes(path));
            JsonNode projects = root.path("projects");
            if (!projects.isArray()) {
                return List.of();
            }
            List<PortfolioScanEntry> entries = new ArrayList<>();
            for (JsonNode project : projects) {
                String name = project.path("name").asText(null);
                if (name == null || name.isBlank()) {
                    continue;
                }
                int readiness = project.path("readiness").asInt(0);
                int baseReadiness = project.path("baseReadiness").asInt(readiness);
                String scannedAt = project.path("scannedAt").asText(null);
                entries.add(new PortfolioScanEntry(name, readiness, baseReadiness, scannedAt));
            }
            return List.copyOf(entries);
        } catch (IOException e) {
            return List.of();
        }
    }
}
