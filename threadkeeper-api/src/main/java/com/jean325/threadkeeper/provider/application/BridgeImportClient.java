package com.jean325.threadkeeper.provider.application;

import com.jean325.threadkeeper.provider.dto.BridgeImportPayload;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;

public interface BridgeImportClient {
    BridgeImportPayload runImport(RunProviderImportRequest request, String codexHome);
}
