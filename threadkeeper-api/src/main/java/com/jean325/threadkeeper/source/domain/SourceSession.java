package com.jean325.threadkeeper.source.domain;

import com.jean325.threadkeeper.global.common.BaseEntity;
import com.jean325.threadkeeper.provider.domain.ProviderConnection;
import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.thread.domain.Thread;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "source_sessions")
public class SourceSession extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "thread_id")
    private Thread thread;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "provider_connection_id")
    private ProviderConnection providerConnection;

    @Column(nullable = false, length = 200)
    private String providerSessionKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ProviderType provider;

    @Column(length = 500)
    private String sourcePath;

    @Column(length = 50)
    private String sourceType;

    @Column(length = 200)
    private String title;

    private Instant startedAt;

    private Instant lastActivityAt;

    @Column(nullable = false)
    private Instant importedAt;

    @Lob
    @Column(nullable = false)
    private String metadataJson;

    protected SourceSession() {
    }

    public SourceSession(
            Thread thread,
            ProviderConnection providerConnection,
            String providerSessionKey,
            ProviderType provider,
            String sourcePath,
            String sourceType,
            String title,
            String metadataJson
    ) {
        this.thread = thread;
        this.providerConnection = providerConnection;
        this.providerSessionKey = providerSessionKey;
        this.provider = provider;
        this.sourcePath = sourcePath;
        this.sourceType = sourceType;
        this.title = title;
        this.importedAt = Instant.now();
        this.lastActivityAt = this.importedAt;
        this.metadataJson = metadataJson == null || metadataJson.isBlank() ? "{}" : metadataJson;
    }

    public Long getId() {
        return id;
    }

    public Thread getThread() {
        return thread;
    }

    public ProviderConnection getProviderConnection() {
        return providerConnection;
    }

    public String getProviderSessionKey() {
        return providerSessionKey;
    }

    public ProviderType getProvider() {
        return provider;
    }

    public String getSourcePath() {
        return sourcePath;
    }

    public String getSourceType() {
        return sourceType;
    }

    public String getTitle() {
        return title;
    }

    public Instant getImportedAt() {
        return importedAt;
    }

    public String getMetadataJson() {
        return metadataJson;
    }

    public void refreshFromImport(String sourcePath, String sourceType, String title, String metadataJson) {
        this.sourcePath = sourcePath;
        this.sourceType = sourceType;
        this.title = title;
        this.lastActivityAt = Instant.now();
        this.importedAt = this.lastActivityAt;
        this.metadataJson = metadataJson == null || metadataJson.isBlank() ? "{}" : metadataJson;
    }
}
