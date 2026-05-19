package com.jean325.threadkeeper.provider.application;

import com.jean325.threadkeeper.provider.domain.ProviderConnection;
import com.jean325.threadkeeper.provider.domain.ProviderConnectionRepository;
import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.provider.dto.CreateProviderConnectionRequest;
import com.jean325.threadkeeper.provider.dto.BridgeImportPayload;
import com.jean325.threadkeeper.provider.dto.ImportSourceSessionsRequest;
import com.jean325.threadkeeper.provider.dto.ProviderConnectionResponse;
import com.jean325.threadkeeper.provider.dto.RunProviderImportRequest;
import com.jean325.threadkeeper.snapshot.domain.SnapshotType;
import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshot;
import com.jean325.threadkeeper.snapshot.domain.ThreadSnapshotRepository;
import com.jean325.threadkeeper.source.domain.SourceSession;
import com.jean325.threadkeeper.source.domain.SourceSessionRepository;
import com.jean325.threadkeeper.source.dto.SourceSessionResponse;
import com.jean325.threadkeeper.thread.domain.ThreadStatus;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProviderConnectionService {

    private final ProviderConnectionRepository providerConnectionRepository;
    private final ThreadRepository threadRepository;
    private final SourceSessionRepository sourceSessionRepository;
    private final ThreadSnapshotRepository threadSnapshotRepository;
    private final BridgeImportClient bridgeImportClient;

    public ProviderConnectionService(
            ProviderConnectionRepository providerConnectionRepository,
            ThreadRepository threadRepository,
            SourceSessionRepository sourceSessionRepository,
            ThreadSnapshotRepository threadSnapshotRepository,
            BridgeImportClient bridgeImportClient
    ) {
        this.providerConnectionRepository = providerConnectionRepository;
        this.threadRepository = threadRepository;
        this.sourceSessionRepository = sourceSessionRepository;
        this.threadSnapshotRepository = threadSnapshotRepository;
        this.bridgeImportClient = bridgeImportClient;
    }

    @Transactional(readOnly = true)
    public List<ProviderConnectionResponse> listConnections() {
        return providerConnectionRepository.findAll()
                .stream()
                .map(ProviderConnectionResponse::from)
                .toList();
    }

    @Transactional
    public ProviderConnectionResponse createConnection(CreateProviderConnectionRequest request) {
        ProviderConnection connection = new ProviderConnection(
                request.provider(),
                request.accountLabel(),
                request.homePath()
        );
        return ProviderConnectionResponse.from(providerConnectionRepository.save(connection));
    }

    @Transactional
    public List<SourceSessionResponse> importSourceSessions(Long connectionId, ImportSourceSessionsRequest request) {
        ProviderConnection connection = providerConnectionRepository.findById(connectionId).orElseThrow();
        List<SourceSession> imported = request.sourceSessions().stream()
                .map(item -> importSingle(connection, item))
                .toList();
        connection.markImported();
        return imported.stream().map(SourceSessionResponse::from).toList();
    }

    @Transactional
    public List<SourceSessionResponse> runImport(Long connectionId, RunProviderImportRequest request) {
        BridgeImportPayload payload = bridgeImportClient.runImport(request);
        ImportSourceSessionsRequest importRequest = new ImportSourceSessionsRequest(
                request.profile() == null ? "full" : request.profile(),
                request.includeSensitive(),
                payload.sourceSessions().stream()
                        .map(item -> new ImportSourceSessionsRequest.SourceSessionImportRequest(
                                null,
                                null,
                                item.provider(),
                                item.providerSessionKey(),
                                item.sourceType(),
                                item.sourcePath(),
                                item.title(),
                                item.metadataJson()
                        ))
                        .toList()
        );
        return importSourceSessions(connectionId, importRequest);
    }

    private SourceSession importSingle(
            ProviderConnection connection,
            ImportSourceSessionsRequest.SourceSessionImportRequest item
    ) {
        ProviderType providerType = ProviderType.valueOf(item.provider());
        SourceSession existing = sourceSessionRepository
                .findByProviderConnectionIdAndProviderSessionKey(connection.getId(), item.providerSessionKey())
                .orElse(null);
        if (existing != null) {
            existing.refreshFromImport(item.sourcePath(), item.sourceType(), item.title(), item.metadataJson());
            existing.getThread().touch("Review refreshed imported context.");
            threadSnapshotRepository.save(new ThreadSnapshot(
                    existing.getThread(),
                    SnapshotType.PROGRESS,
                    "Refreshed imported source session from " + providerType.name() + ".",
                    "Review updated context.",
                    null,
                    null,
                    null
            ));
            return existing;
        }

        Thread thread = findOrCreateThreadForImport(providerType, item);
        SourceSession sourceSession = sourceSessionRepository.save(new SourceSession(
                thread,
                connection,
                item.providerSessionKey(),
                providerType,
                item.sourcePath(),
                item.sourceType(),
                item.title(),
                item.metadataJson()
        ));

        threadSnapshotRepository.save(new ThreadSnapshot(
                thread,
                SnapshotType.PROGRESS,
                "Imported source session from " + providerType.name() + ".",
                "Review imported thread and decide whether to merge or continue.",
                null,
                null,
                null
        ));

        return sourceSession;
    }

    private Thread findOrCreateThreadForImport(
            ProviderType providerType,
            ImportSourceSessionsRequest.SourceSessionImportRequest item
    ) {
        String title = item.title() == null || item.title().isBlank()
                ? providerType.name() + " " + item.sourceType() + " session"
                : item.title();

        if (item.threadId() != null) {
            Thread explicitThread = threadRepository.findById(item.threadId()).orElseThrow();
            explicitThread.touch("Review linked import for " + providerType.name() + ".");
            return explicitThread;
        }

        if (item.projectKey() != null && !item.projectKey().isBlank()) {
            Thread sameProjectAndTitle = threadRepository
                    .findTopByProjectKeyIgnoreCaseAndTitleIgnoreCaseAndStatusOrderByLastActivityAtDesc(
                            item.projectKey(),
                            title,
                            ThreadStatus.ACTIVE
                    );
            if (sameProjectAndTitle != null) {
                sameProjectAndTitle.touch("Review linked import for " + providerType.name() + ".");
                return sameProjectAndTitle;
            }
        }

        Thread existingByTitle = threadRepository.findTopByTitleIgnoreCaseAndStatusOrderByLastActivityAtDesc(
                title,
                ThreadStatus.ACTIVE
        );
        if (existingByTitle != null) {
            existingByTitle.touch("Review linked import for " + providerType.name() + ".");
            return existingByTitle;
        }

        return threadRepository.save(new Thread(
                item.projectKey() == null || item.projectKey().isBlank()
                        ? "imported-" + providerType.name().toLowerCase()
                        : item.projectKey(),
                title,
                ThreadPriority.MEDIUM,
                "Imported from " + providerType.name() + " " + item.sourceType() + ".",
                "Review imported context and set next action.",
                "Thread is classified and linked to a concrete task."
        ));
    }
}
