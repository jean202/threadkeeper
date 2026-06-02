package com.jean325.threadkeeper.provider.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jean325.threadkeeper.provider.application.BridgeImportClient;
import com.jean325.threadkeeper.provider.dto.BridgeImportPayload;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProviderConnectionRunImportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BridgeImportClient bridgeImportClient;

    @Test
    void runsBridgeImportAndPersistsSourceSessions() throws Exception {
        when(bridgeImportClient.runImport(any(), any())).thenReturn(new BridgeImportPayload(
                "2026-04-29T00:00:00Z",
                List.of("CODEX"),
                List.of(new BridgeImportPayload.SourceSessionPayload(
                        "CODEX",
                        "session-run-1",
                        "sessions",
                        "/Users/jean325/.codex/sessions/session-run-1.json",
                        "Bridge imported session",
                        "2026-04-29T00:00:00Z",
                        "{\"itemId\":\"codex:sessions\"}",
                        null,
                        null,
                        null,
                        null,
                        null
                ))
        ));

        mockMvc.perform(post("/api/v1/provider-connections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "CODEX",
                                  "accountLabel": "default",
                                  "homePath": "/Users/jean325"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/provider-connections/1/imports/run")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "migratorPath": "/tmp/agent-state-migrator",
                                  "profile": "full",
                                  "target": "codex",
                                  "includeSensitive": false
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].provider").value("CODEX"))
                .andExpect(jsonPath("$[0].providerSessionKey").value("session-run-1"));
    }
}
