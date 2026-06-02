package com.jean325.threadkeeper.provider.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jean325.threadkeeper.global.error.ApiException;
import com.jean325.threadkeeper.provider.dto.ImportSourceSessionsRequest;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class ProviderConnectionNotFoundTest {

    private static final Long MISSING_ID = 999_999L;

    @Autowired
    ProviderConnectionService service;

    @Test
    void runImportThrowsNotFoundWhenConnectionMissing() {
        RunProviderImportRequest request = new RunProviderImportRequest("/m", "/b", "full", "codex", false);

        assertThatThrownBy(() -> service.runImport(MISSING_ID, request))
                .isInstanceOfSatisfying(ApiException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo("PROVIDER_CONNECTION_NOT_FOUND");
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                });
    }

    @Test
    void importSourceSessionsThrowsNotFoundWhenConnectionMissing() {
        ImportSourceSessionsRequest request = new ImportSourceSessionsRequest("full", false, List.of(
                new ImportSourceSessionsRequest.SourceSessionImportRequest(
                        null, "p", "CODEX", "codex-1", "session", "/p/a.jsonl",
                        "t1", "{}", "i1", "n1", null, null)));

        assertThatThrownBy(() -> service.importSourceSessions(MISSING_ID, request))
                .isInstanceOfSatisfying(ApiException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo("PROVIDER_CONNECTION_NOT_FOUND");
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                });
    }

    @Test
    void resetConnectionImportsThrowsNotFoundWhenConnectionMissing() {
        assertThatThrownBy(() -> service.resetConnectionImports(MISSING_ID))
                .isInstanceOfSatisfying(ApiException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo("PROVIDER_CONNECTION_NOT_FOUND");
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                });
    }
}
