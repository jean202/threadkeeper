package com.jean325.threadkeeper.provider.application;

import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.provider.dto.CreateProviderConnectionRequest;
import com.jean325.threadkeeper.provider.dto.ImportSourceSessionsRequest;
import com.jean325.threadkeeper.provider.dto.ResetConnectionImportsResponse;
import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshotRepository;
import com.jean325.threadkeeper.source.domain.SourceSessionRepository;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class ProviderConnectionResetServiceTest {

    @Autowired ProviderConnectionService service;
    @Autowired SourceSessionRepository sourceSessionRepository;
    @Autowired ThreadSnapshotRepository threadSnapshotRepository;
    @Autowired ThreadRepository threadRepository;

    @Test
    void resetDeletesCodexImportsAndPreservesClaudeAndManual() {
        Long codexId = service.createConnection(
                new CreateProviderConnectionRequest(ProviderType.CODEX, "codex", null)).id();
        Long claudeId = service.createConnection(
                new CreateProviderConnectionRequest(ProviderType.CLAUDE, "claude", null)).id();

        // CODEX session
        service.importSourceSessions(codexId, new ImportSourceSessionsRequest("full", false,
                List.of(new ImportSourceSessionsRequest.SourceSessionImportRequest(
                        null, "p", "CODEX", "codex-1", "session", "/p/a.jsonl",
                        "t1", "{}", "i1", "n1", null, null))));
        // CLAUDE session
        service.importSourceSessions(claudeId, new ImportSourceSessionsRequest("full", false,
                List.of(new ImportSourceSessionsRequest.SourceSessionImportRequest(
                        null, "p", "CLAUDE", "claude-1", "session", "/p/b.json",
                        "t2", "{}", "i2", "n2", null, null))));
        // Manual thread (no source session)
        Thread manual = threadRepository.save(new Thread(
                "manual", "manual-title", ThreadPriority.MEDIUM, "intent", "g", "done"));

        ResetConnectionImportsResponse result = service.resetConnectionImports(codexId);

        assertThat(result.sourceSessionsDeleted()).isEqualTo(1);
        assertThat(result.threadsDeleted()).isEqualTo(1);
        assertThat(result.snapshotsDeleted()).isGreaterThanOrEqualTo(1);
        assertThat(sourceSessionRepository.findByProviderConnectionIdAndProviderSessionKey(codexId, "codex-1")).isEmpty();
        assertThat(sourceSessionRepository.findByProviderConnectionIdAndProviderSessionKey(claudeId, "claude-1")).isPresent();
        assertThat(threadRepository.findById(manual.getId())).isPresent();
    }
}
