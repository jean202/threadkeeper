package com.jean325.threadkeeper.provider.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ImportSourceSessionsRequestJsonTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void deserializesRichImportFields() throws Exception {
        String json = """
            {
              "profile": "full",
              "includeSensitive": false,
              "sourceSessions": [{
                "provider": "CODEX",
                "providerSessionKey": "id-1",
                "sourceType": "session",
                "sourcePath": "/p/rollout.jsonl",
                "title": "Fix login",
                "projectKey": "example-api",
                "originalIntent": "intent",
                "nextAction": "next",
                "startedAt": "2026-05-01T10:00:00Z",
                "lastActivityAt": "2026-05-01T10:30:00Z",
                "metadataJson": "{}"
              }]
            }
            """;
        ImportSourceSessionsRequest req = mapper.readValue(json, ImportSourceSessionsRequest.class);
        ImportSourceSessionsRequest.SourceSessionImportRequest s = req.sourceSessions().get(0);
        assertThat(s.originalIntent()).isEqualTo("intent");
        assertThat(s.nextAction()).isEqualTo("next");
        assertThat(s.startedAt()).isEqualTo("2026-05-01T10:00:00Z");
        assertThat(s.lastActivityAt()).isEqualTo("2026-05-01T10:30:00Z");
    }
}
