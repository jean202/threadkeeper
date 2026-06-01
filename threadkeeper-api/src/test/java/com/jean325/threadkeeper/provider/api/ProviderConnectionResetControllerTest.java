package com.jean325.threadkeeper.provider.api;

import com.jean325.threadkeeper.provider.application.ProviderConnectionService;
import com.jean325.threadkeeper.provider.dto.ResetConnectionImportsResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProviderConnectionController.class)
class ProviderConnectionResetControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean ProviderConnectionService service;

    @Test
    void deleteImportsReturnsCounts() throws Exception {
        when(service.resetConnectionImports(eq(1L)))
                .thenReturn(new ResetConnectionImportsResponse(29, 29, 30));

        mockMvc.perform(delete("/api/v1/provider-connections/1/imports"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.threadsDeleted").value(29))
                .andExpect(jsonPath("$.sourceSessionsDeleted").value(29))
                .andExpect(jsonPath("$.snapshotsDeleted").value(30));
    }
}
