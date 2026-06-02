package com.jean325.threadkeeper.provider.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProcessBridgeImportClientTest {

    private final ProcessBridgeImportClient client = new ProcessBridgeImportClient(new ObjectMapper());

    private RunProviderImportRequest request() {
        return new RunProviderImportRequest("/tmp/migrator", "/tmp/bridge", "full", "codex", false);
    }

    @Test
    void includesCodexHomeWhenProvided() {
        List<String> command = client.buildCommand(request(), "/custom/codex/sessions");

        assertThat(command).containsSequence("--codex-home", "/custom/codex/sessions");
    }

    @Test
    void omitsCodexHomeWhenBlank() {
        List<String> command = client.buildCommand(request(), "   ");

        assertThat(command).doesNotContain("--codex-home");
    }

    @Test
    void omitsCodexHomeWhenNull() {
        List<String> command = client.buildCommand(request(), null);

        assertThat(command).doesNotContain("--codex-home");
    }
}
