package com.jean325.threadkeeper.provider.api;

import com.jean325.threadkeeper.provider.application.ProviderConnectionService;
import com.jean325.threadkeeper.provider.dto.CreateProviderConnectionRequest;
import com.jean325.threadkeeper.provider.dto.ImportSourceSessionsRequest;
import com.jean325.threadkeeper.provider.dto.LatestImportResponse;
import com.jean325.threadkeeper.provider.dto.ProviderConnectionResponse;
import com.jean325.threadkeeper.provider.dto.ResetConnectionImportsResponse;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import com.jean325.threadkeeper.source.dto.SourceSessionResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/provider-connections")
public class ProviderConnectionController {

    private final ProviderConnectionService providerConnectionService;

    public ProviderConnectionController(ProviderConnectionService providerConnectionService) {
        this.providerConnectionService = providerConnectionService;
    }

    @GetMapping
    public List<ProviderConnectionResponse> listConnections() {
        return providerConnectionService.listConnections();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProviderConnectionResponse createConnection(@Valid @RequestBody CreateProviderConnectionRequest request) {
        return providerConnectionService.createConnection(request);
    }

    @PostMapping("/{connectionId}/imports")
    @ResponseStatus(HttpStatus.CREATED)
    public List<SourceSessionResponse> importSourceSessions(
            @PathVariable Long connectionId,
            @Valid @RequestBody ImportSourceSessionsRequest request
    ) {
        return providerConnectionService.importSourceSessions(connectionId, request);
    }

    @PostMapping("/{connectionId}/imports/run")
    @ResponseStatus(HttpStatus.CREATED)
    public List<SourceSessionResponse> runImport(
            @PathVariable Long connectionId,
            @Valid @RequestBody RunProviderImportRequest request
    ) {
        return providerConnectionService.runImport(connectionId, request);
    }

    @GetMapping("/{connectionId}/imports/latest")
    public LatestImportResponse latestImport(@PathVariable Long connectionId) {
        return providerConnectionService.latestImport(connectionId);
    }

    @DeleteMapping("/{connectionId}/imports")
    public ResetConnectionImportsResponse resetImports(@PathVariable Long connectionId) {
        return providerConnectionService.resetConnectionImports(connectionId);
    }
}
