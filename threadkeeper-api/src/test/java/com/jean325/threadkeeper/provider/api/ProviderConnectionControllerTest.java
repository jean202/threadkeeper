package com.jean325.threadkeeper.provider.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class ProviderConnectionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createsConnectionAndImportsSourceSessions() throws Exception {
        mockMvc.perform(post("/api/v1/provider-connections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "provider": "CODEX",
                                  "accountLabel": "default",
                                  "homePath": "/Users/jean325"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.provider").value("CODEX"));

        mockMvc.perform(post("/api/v1/provider-connections/1/imports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "profile": "full",
                                  "includeSensitive": false,
                                  "sourceSessions": [
                                    {
                                      "provider": "CODEX",
                                      "providerSessionKey": "session-1",
                                      "sourceType": "sessions",
                                      "sourcePath": "/Users/jean325/.codex/sessions/session-1.json",
                                      "title": "Codex sessions",
                                      "metadataJson": "{\\"itemId\\":\\"codex:sessions\\"}"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$[0].provider").value("CODEX"))
                .andExpect(jsonPath("$[0].providerSessionKey").value("session-1"));

        mockMvc.perform(get("/api/v1/provider-connections"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].lastImportAt").exists());
    }
}
