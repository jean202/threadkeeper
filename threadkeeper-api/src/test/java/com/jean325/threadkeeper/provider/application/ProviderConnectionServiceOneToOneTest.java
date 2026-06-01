package com.jean325.threadkeeper.provider.application;

import com.jean325.threadkeeper.provider.dto.CreateProviderConnectionRequest;
import com.jean325.threadkeeper.provider.dto.ImportSourceSessionsRequest;
import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.source.domain.SourceSession;
import com.jean325.threadkeeper.source.domain.SourceSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class ProviderConnectionServiceOneToOneTest {

    @Autowired ProviderConnectionService service;
    @Autowired SourceSessionRepository sourceSessionRepository;

    private Long connectionId;

    @BeforeEach
    void setUp() {
        connectionId = service.createConnection(
                new CreateProviderConnectionRequest(ProviderType.CODEX, "label", null)).id();
    }

    @Test
    void twoCodexSessionsWithIdenticalTitleProduceTwoThreads() {
        ImportSourceSessionsRequest.SourceSessionImportRequest a =
                new ImportSourceSessionsRequest.SourceSessionImportRequest(
                        null, "example-api", "CODEX", "id-A", "session", "/p/a.jsonl",
                        "Same title", "{}", "intent-a", "next-a", null, null);
        ImportSourceSessionsRequest.SourceSessionImportRequest b =
                new ImportSourceSessionsRequest.SourceSessionImportRequest(
                        null, "example-api", "CODEX", "id-B", "session", "/p/b.jsonl",
                        "Same title", "{}", "intent-b", "next-b", null, null);

        service.importSourceSessions(connectionId, new ImportSourceSessionsRequest("full", false, List.of(a, b)));

        SourceSession sA = sourceSessionRepository
                .findByProviderConnectionIdAndProviderSessionKey(connectionId, "id-A").orElseThrow();
        SourceSession sB = sourceSessionRepository
                .findByProviderConnectionIdAndProviderSessionKey(connectionId, "id-B").orElseThrow();
        assertThat(sA.getThread().getId()).isNotEqualTo(sB.getThread().getId());
        assertThat(sA.getThread().getOriginalIntent()).isEqualTo("intent-a");
        assertThat(sB.getThread().getOriginalIntent()).isEqualTo("intent-b");
    }
}
