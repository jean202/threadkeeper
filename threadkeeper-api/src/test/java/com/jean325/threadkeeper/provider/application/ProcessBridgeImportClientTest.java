package com.jean325.threadkeeper.provider.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.provider.dto.BridgeImportPayload;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProcessBridgeImportClientTest {

    // Raw, bridge-shaped JSON: each session carries a nested `metadata` object (not a metadataJson
    // string) alongside the rich top-level fields. transformPayload must collapse `metadata` into a
    // `metadataJson` string while leaving the rich fields intact.
    private static final String RAW_BRIDGE_JSON = """
        {
          "importedAt": "2026-05-30T00:00:00Z",
          "providers": ["CODEX"],
          "sourceSessions": [{
            "provider": "CODEX",
            "providerSessionKey": "id-1",
            "sourceType": "session",
            "sourcePath": "/p/rollout.jsonl",
            "title": "Fix login",
            "importedAt": "2026-05-30T00:00:00Z",
            "startedAt": "2026-05-01T10:00:00Z",
            "lastActivityAt": "2026-05-01T10:30:00Z",
            "projectKey": "example-api",
            "originalIntent": "Fix the login bug",
            "nextAction": "Inspect auth.ts",
            "metadata": { "sourceType": "session", "cwd": "/home/u/example-api" }
          }]
        }
        """;

    private final ProcessBridgeImportClient client = new ProcessBridgeImportClient(new ObjectMapper());

    private RunProviderImportRequest request() {
        return new RunProviderImportRequest("/tmp/migrator", "/tmp/bridge", "full", "codex", false);
    }

    @Test
    void includesCodexHomeWhenProvided() {
        List<String> command = client.buildCommand(request(), "/custom/codex/sessions");

        assertThat(command).containsSequence("--codex-home", "/custom/codex/sessions");
    }

    @Test
    void omitsCodexHomeWhenBlank() {
        List<String> command = client.buildCommand(request(), "   ");

        assertThat(command).doesNotContain("--codex-home");
    }

    @Test
    void omitsCodexHomeWhenNull() {
        List<String> command = client.buildCommand(request(), null);

        assertThat(command).doesNotContain("--codex-home");
    }

    @Test
    void transformPayloadInjectsMetadataJsonAndPreservesRichFields() throws Exception {
        // Mirrors Spring's auto-configured ObjectMapper, which disables FAIL_ON_UNKNOWN_PROPERTIES.
        ObjectMapper mapper = new ObjectMapper()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        JsonNode transformed = new ProcessBridgeImportClient(mapper)
                .transformPayload(mapper.readTree(RAW_BRIDGE_JSON));
        BridgeImportPayload payload = mapper.treeToValue(transformed, BridgeImportPayload.class);
        BridgeImportPayload.SourceSessionPayload session = payload.sourceSessions().get(0);

        // The nested metadata object is collapsed into a metadataJson string.
        JsonNode metadataJson = mapper.readTree(session.metadataJson());
        assertThat(metadataJson.get("sourceType").asText()).isEqualTo("session");
        assertThat(metadataJson.get("cwd").asText()).isEqualTo("/home/u/example-api");

        // The rich top-level fields survive the transform into BridgeImportPayload.
        assertThat(session.provider()).isEqualTo("CODEX");
        assertThat(session.providerSessionKey()).isEqualTo("id-1");
        assertThat(session.sourceType()).isEqualTo("session");
        assertThat(session.sourcePath()).isEqualTo("/p/rollout.jsonl");
        assertThat(session.title()).isEqualTo("Fix login");
        assertThat(session.startedAt()).isEqualTo("2026-05-01T10:00:00Z");
        assertThat(session.lastActivityAt()).isEqualTo("2026-05-01T10:30:00Z");
        assertThat(session.projectKey()).isEqualTo("example-api");
        assertThat(session.originalIntent()).isEqualTo("Fix the login bug");
        assertThat(session.nextAction()).isEqualTo("Inspect auth.ts");
    }

    @Test
    void transformPayloadLeavesMetadataKeyRequiringLenientDeserialization() throws Exception {
        // transformPayload adds metadataJson but does NOT strip the original `metadata` key, so the
        // tree still carries a property absent from SourceSessionPayload. This locks in the seam's
        // reliance on FAIL_ON_UNKNOWN_PROPERTIES=false: a strict mapper rejects the leftover key.
        ObjectMapper strictMapper = new ObjectMapper()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, true);

        JsonNode transformed = new ProcessBridgeImportClient(strictMapper)
                .transformPayload(strictMapper.readTree(RAW_BRIDGE_JSON));

        assertThatThrownBy(() -> strictMapper.treeToValue(transformed, BridgeImportPayload.class))
                .isInstanceOf(JsonProcessingException.class)
                .hasMessageContaining("metadata");
    }
}
