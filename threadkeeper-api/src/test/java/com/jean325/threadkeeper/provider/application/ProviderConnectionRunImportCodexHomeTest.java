package com.jean325.threadkeeper.provider.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.provider.dto.BridgeImportPayload;
import com.jean325.threadkeeper.provider.dto.CreateProviderConnectionRequest;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class ProviderConnectionRunImportCodexHomeTest {

    @Autowired
    ProviderConnectionService service;

    @MockBean
    BridgeImportClient bridgeImportClient;

    private static BridgeImportPayload emptyPayload() {
        return new BridgeImportPayload("2026-06-02T00:00:00Z", List.of("CODEX"), List.of());
    }

    private Long createConnection(String homePath) {
        return service.createConnection(
                new CreateProviderConnectionRequest(ProviderType.CODEX, "label", homePath)).id();
    }

    @Test
    void passesConnectionHomePathToBridgeAsCodexHome() {
        when(bridgeImportClient.runImport(any(), any())).thenReturn(emptyPayload());
        Long connectionId = createConnection("/custom/codex/sessions");

        service.runImport(connectionId, new RunProviderImportRequest("/m", "/b", "full", "codex", false));

        ArgumentCaptor<String> codexHome = ArgumentCaptor.forClass(String.class);
        verify(bridgeImportClient).runImport(any(RunProviderImportRequest.class), codexHome.capture());
        assertThat(codexHome.getValue()).isEqualTo("/custom/codex/sessions");
    }

    @Test
    void leavesCodexHomeUnsetWhenConnectionHomePathBlank() {
        when(bridgeImportClient.runImport(any(), any())).thenReturn(emptyPayload());
        Long connectionId = createConnection(null);

        service.runImport(connectionId, new RunProviderImportRequest("/m", "/b", "full", "codex", false));

        ArgumentCaptor<String> codexHome = ArgumentCaptor.forClass(String.class);
        verify(bridgeImportClient).runImport(any(RunProviderImportRequest.class), codexHome.capture());
        // Blank/null home path is passed through unchanged so the bridge falls back to ~/.codex/sessions.
        assertThat(codexHome.getValue()).isNull();
    }
}
