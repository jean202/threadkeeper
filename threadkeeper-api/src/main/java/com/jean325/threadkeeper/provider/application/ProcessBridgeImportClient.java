package com.jean325.threadkeeper.provider.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.global.error.ApiException;
import com.jean325.threadkeeper.provider.dto.BridgeImportPayload;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class ProcessBridgeImportClient implements BridgeImportClient {

    private final ObjectMapper objectMapper;

    public ProcessBridgeImportClient(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public BridgeImportPayload runImport(RunProviderImportRequest request, String codexHome) {
        try {
            Process process = new ProcessBuilder(buildCommand(request, codexHome))
                    .directory(resolveBridgeDirectory(request).toFile())
                    .redirectErrorStream(true)
                    .start();

            String output = new String(process.getInputStream().readAllBytes());
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                throw new ApiException(
                        "BRIDGE_IMPORT_FAILED",
                        "Bridge import process failed: " + output,
                        HttpStatus.BAD_GATEWAY
                );
            }

            JsonNode root = objectMapper.readTree(output);
            return objectMapper.treeToValue(transformPayload(root), BridgeImportPayload.class);
        } catch (IOException | InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ApiException(
                    "BRIDGE_IMPORT_FAILED",
                    "Failed to run bridge import: " + ex.getMessage(),
                    HttpStatus.BAD_GATEWAY
            );
        }
    }

    List<String> buildCommand(RunProviderImportRequest request, String codexHome) {
        List<String> command = new ArrayList<>();
        command.add("node");
        command.add("src/cli.js");
        command.add("--migrator-path");
        command.add(request.migratorPath());
        command.add("--profile");
        command.add(request.profile() == null ? "full" : request.profile());
        command.add("--target");
        command.add(request.target() == null ? "codex,claude" : request.target());
        if (request.includeSensitive()) {
            command.add("--include-sensitive");
        }
        if (codexHome != null && !codexHome.isBlank()) {
            command.add("--codex-home");
            command.add(codexHome);
        }
        return command;
    }

    private Path resolveBridgeDirectory(RunProviderImportRequest request) {
        if (request.bridgePath() != null && !request.bridgePath().isBlank()) {
            return Path.of(request.bridgePath());
        }
        return Path.of("").toAbsolutePath().getParent().resolve("agent-state-migrator-bridge");
    }

    JsonNode transformPayload(JsonNode root) {
        if (!root.has("sourceSessions")) {
            return root;
        }

        for (JsonNode session : root.get("sourceSessions")) {
            JsonNode metadata = session.get("metadata");
            if (metadata != null && !metadata.isMissingNode()) {
                ((com.fasterxml.jackson.databind.node.ObjectNode) session)
                        .put("metadataJson", metadata.toString());
            }
        }
        return root;
    }
}
