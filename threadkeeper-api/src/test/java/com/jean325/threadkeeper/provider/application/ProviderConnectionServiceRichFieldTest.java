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
        when(bridgeImportClient.runImport(any(RunProviderImportRequest.class), any())).thenReturn(payload);

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
        when(bridgeImportClient.runImport(any(RunProviderImportRequest.class), any())).thenReturn(first);
        service.runImport(connectionId, new RunProviderImportRequest("/u","/u","full","codex",false));

        // Second run with the same session grown (new last-activity, different intent attempt, new next action)
        BridgeImportPayload second = new BridgeImportPayload(
                "2026-05-30T01:00:00Z", List.of("CODEX"),
                List.of(new BridgeImportPayload.SourceSessionPayload(
                        "CODEX", "session-X", "session", "/p/x.jsonl",
                        "Title v2", "2026-05-30T01:00:00Z", "{}",
                        "2026-05-01T10:00:00Z", "2026-05-02T12:00:00Z",
                        "example-api", "DIFFERENT intent attempt", "NEW next")));
        when(bridgeImportClient.runImport(any(RunProviderImportRequest.class), any())).thenReturn(second);
        service.runImport(connectionId, new RunProviderImportRequest("/u","/u","full","codex",false));

        SourceSession s = sourceSessionRepository
                .findByProviderConnectionIdAndProviderSessionKey(connectionId, "session-X").orElseThrow();
        Thread thread = s.getThread();
        assertThat(thread.getOriginalIntent()).isEqualTo("ORIGINAL intent"); // unchanged on refresh
        assertThat(thread.getCurrentNextAction()).isEqualTo("NEW next");
        assertThat(thread.getLastActivityAt().toString()).isEqualTo("2026-05-02T12:00:00Z");
        assertThat(s.getLastActivityAt().toString()).isEqualTo("2026-05-02T12:00:00Z");
    }

    @Test
    void refreshReplacesTheTitleAndIntentAnImportCouldOnlyGuess() {
        // An older bridge could not find the prompt, so the session came in
        // with a placeholder title and no intent.
        BridgeImportPayload first = new BridgeImportPayload(
                "2026-09-27T00:00:00Z", List.of("CODEX"),
                List.of(new BridgeImportPayload.SourceSessionPayload(
                        "CODEX", "session-P", "session", "/p/p.jsonl",
                        "record-to-evidence session 2026-09-27", "2026-09-27T00:00:00Z", "{}",
                        "2026-09-27T01:00:00Z", "2026-09-27T01:30:00Z",
                        "record-to-evidence", null, null)));
        when(bridgeImportClient.runImport(any(RunProviderImportRequest.class), any())).thenReturn(first);
        service.runImport(connectionId, new RunProviderImportRequest(null, null, "full", "codex", false));

        BridgeImportPayload second = new BridgeImportPayload(
                "2026-10-04T00:00:00Z", List.of("CODEX"),
                List.of(new BridgeImportPayload.SourceSessionPayload(
                        "CODEX", "session-P", "session", "/p/p.jsonl",
                        "녹음 내용 정리", "2026-10-04T00:00:00Z", "{}",
                        "2026-09-27T01:00:00Z", "2026-09-27T01:30:00Z",
                        "record-to-evidence", "녹음 내용 정리해줘", "정리했어요")));
        when(bridgeImportClient.runImport(any(RunProviderImportRequest.class), any())).thenReturn(second);
        service.runImport(connectionId, new RunProviderImportRequest(null, null, "full", "codex", false));

        Thread thread = sourceSessionRepository
                .findByProviderConnectionIdAndProviderSessionKey(connectionId, "session-P").orElseThrow()
                .getThread();
        assertThat(thread.getTitle()).isEqualTo("녹음 내용 정리");
        assertThat(thread.getOriginalIntent()).isEqualTo("녹음 내용 정리해줘");
    }

    @Test
    void refreshLeavesATitleTheImportDidNotGiveAlone() {
        BridgeImportPayload first = new BridgeImportPayload(
                "2026-09-27T00:00:00Z", List.of("CODEX"),
                List.of(new BridgeImportPayload.SourceSessionPayload(
                        "CODEX", "session-Q", "session", "/p/q.jsonl",
                        "Imported title", "2026-09-27T00:00:00Z", "{}",
                        null, null, "example-api", "Real intent", null)));
        when(bridgeImportClient.runImport(any(RunProviderImportRequest.class), any())).thenReturn(first);
        service.runImport(connectionId, new RunProviderImportRequest(null, null, "full", "codex", false));

        Thread thread = sourceSessionRepository
                .findByProviderConnectionIdAndProviderSessionKey(connectionId, "session-Q").orElseThrow()
                .getThread();
        org.springframework.test.util.ReflectionTestUtils.setField(thread, "title", "Named by hand");

        BridgeImportPayload second = new BridgeImportPayload(
                "2026-10-04T00:00:00Z", List.of("CODEX"),
                List.of(new BridgeImportPayload.SourceSessionPayload(
                        "CODEX", "session-Q", "session", "/p/q.jsonl",
                        "Newer import title", "2026-10-04T00:00:00Z", "{}",
                        null, null, "example-api", "Another intent", null)));
        when(bridgeImportClient.runImport(any(RunProviderImportRequest.class), any())).thenReturn(second);
        service.runImport(connectionId, new RunProviderImportRequest(null, null, "full", "codex", false));

        assertThat(thread.getTitle()).isEqualTo("Named by hand");
        assertThat(thread.getOriginalIntent()).isEqualTo("Real intent");
    }
}
