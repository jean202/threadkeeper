package com.jean325.threadkeeper.provider.application;

import com.jean325.threadkeeper.provider.dto.BridgeImportPayload;
import com.jean325.threadkeeper.provider.dto.CreateProviderConnectionRequest;
import com.jean325.threadkeeper.provider.dto.ProviderConnectionResponse;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.source.domain.SourceSession;
import com.jean325.threadkeeper.source.domain.SourceSessionRepository;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
@Transactional
class ProviderConnectionServiceRichFieldTest {

    @Autowired ProviderConnectionService service;
    @Autowired SourceSessionRepository sourceSessionRepository;
    @Autowired ThreadRepository threadRepository;
    @MockBean BridgeImportClient bridgeImportClient;

    private Long connectionId;

    @BeforeEach
    void setUp() {
        ProviderConnectionResponse created = service.createConnection(
                new CreateProviderConnectionRequest(ProviderType.CODEX, "label", null));
        connectionId = created.id();
    }

    @Test
    void runImportPopulatesThreadWithRichFields() {
        BridgeImportPayload payload = new BridgeImportPayload(
                "2026-05-30T00:00:00Z",
                List.of("CODEX"),
                List.of(new BridgeImportPayload.SourceSessionPayload(
                        "CODEX", "session-1", "session", "/p/rollout.jsonl",
                        "Fix login", "2026-05-30T00:00:00Z", "{}",
                        "2026-05-01T10:00:00Z", "2026-05-01T10:30:00Z",
                        "example-api", "Fix the login bug", "Inspect auth.ts"))
        );
        when(bridgeImportClient.runImport(any(RunProviderImportRequest.class))).thenReturn(payload);

        service.runImport(connectionId, new RunProviderImportRequest(
                "/unused", "/unused", "full", "codex", false));

        SourceSession s = sourceSessionRepository
                .findByProviderConnectionIdAndProviderSessionKey(connectionId, "session-1")
                .orElseThrow();
        Thread thread = s.getThread();
        assertThat(thread.getOriginalIntent()).isEqualTo("Fix the login bug");
        assertThat(thread.getCurrentNextAction()).isEqualTo("Inspect auth.ts");
        assertThat(thread.getProjectKey()).isEqualTo("example-api");
        assertThat(thread.getTitle()).isEqualTo("Fix login");
        assertThat(s.getStartedAt().toString()).isEqualTo("2026-05-01T10:00:00Z");
        assertThat(s.getLastActivityAt().toString()).isEqualTo("2026-05-01T10:30:00Z");
        assertThat(thread.getLastActivityAt().toString()).isEqualTo("2026-05-01T10:30:00Z");
    }

    @Test
    void refreshKeepsOriginalIntentAndAdvancesNextActionAndLastActivity() {
        BridgeImportPayload first = new BridgeImportPayload(
                "2026-05-30T00:00:00Z", List.of("CODEX"),
                List.of(new BridgeImportPayload.SourceSessionPayload(
                        "CODEX", "session-X", "session", "/p/x.jsonl",
                        "Title v1", "2026-05-30T00:00:00Z", "{}",
                        "2026-05-01T10:00:00Z", "2026-05-01T10:30:00Z",
                        "example-api", "ORIGINAL intent", "old next")));
        when(bridgeImportClient.runImport(any(RunProviderImportRequest.class))).thenReturn(first);
        service.runImport(connectionId, new RunProviderImportRequest("/u","/u","full","codex",false));

        // Second run with the same session grown (new last-activity, different intent attempt, new next action)
        BridgeImportPayload second = new BridgeImportPayload(
                "2026-05-30T01:00:00Z", List.of("CODEX"),
                List.of(new BridgeImportPayload.SourceSessionPayload(
                        "CODEX", "session-X", "session", "/p/x.jsonl",
                        "Title v2", "2026-05-30T01:00:00Z", "{}",
                        "2026-05-01T10:00:00Z", "2026-05-02T12:00:00Z",
                        "example-api", "DIFFERENT intent attempt", "NEW next")));
        when(bridgeImportClient.runImport(any(RunProviderImportRequest.class))).thenReturn(second);
        service.runImport(connectionId, new RunProviderImportRequest("/u","/u","full","codex",false));

        SourceSession s = sourceSessionRepository
                .findByProviderConnectionIdAndProviderSessionKey(connectionId, "session-X").orElseThrow();
        Thread thread = s.getThread();
        assertThat(thread.getOriginalIntent()).isEqualTo("ORIGINAL intent"); // unchanged on refresh
        assertThat(thread.getCurrentNextAction()).isEqualTo("NEW next");
        assertThat(thread.getLastActivityAt().toString()).isEqualTo("2026-05-02T12:00:00Z");
        assertThat(s.getLastActivityAt().toString()).isEqualTo("2026-05-02T12:00:00Z");
    }
}
