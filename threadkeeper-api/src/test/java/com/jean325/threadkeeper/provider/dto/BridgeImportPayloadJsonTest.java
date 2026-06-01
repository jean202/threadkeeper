package com.jean325.threadkeeper.provider.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BridgeImportPayloadJsonTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void deserializesRichSourceSessionFields() throws Exception {
        String json = """
            {
              "importedAt": "2026-05-30T00:00:00Z",
              "providers": ["CODEX"],
              "sourceSessions": [{
                "provider": "CODEX",
                "providerSessionKey": "id-1",
                "sourceType": "session",
                "sourcePath": "/path/rollout-x.jsonl",
                "title": "Fix login",
                "importedAt": "2026-05-30T00:00:00Z",
                "metadataJson": "{}",
                "startedAt": "2026-05-01T10:00:00Z",
                "lastActivityAt": "2026-05-01T10:30:00Z",
                "projectKey": "example-api",
                "originalIntent": "Fix the login bug",
                "nextAction": "Inspect auth.ts"
              }]
            }
            """;
        BridgeImportPayload payload = mapper.readValue(json, BridgeImportPayload.class);
        BridgeImportPayload.SourceSessionPayload s = payload.sourceSessions().get(0);
        assertThat(s.startedAt()).isEqualTo("2026-05-01T10:00:00Z");
        assertThat(s.lastActivityAt()).isEqualTo("2026-05-01T10:30:00Z");
        assertThat(s.projectKey()).isEqualTo("example-api");
        assertThat(s.originalIntent()).isEqualTo("Fix the login bug");
        assertThat(s.nextAction()).isEqualTo("Inspect auth.ts");
    }
}
