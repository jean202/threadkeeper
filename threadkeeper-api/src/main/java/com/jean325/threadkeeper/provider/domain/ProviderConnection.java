package com.jean325.threadkeeper.provider.domain;

import com.jean325.threadkeeper.global.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "provider_connections")
public class ProviderConnection extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ProviderType provider;

    @Column(length = 100)
    private String accountLabel;

    @Column(length = 300)
    private String homePath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProviderConnectionStatus status;

    private Instant lastImportAt;

    private String lastErrorMessage;

    protected ProviderConnection() {
    }

    public ProviderConnection(ProviderType provider, String accountLabel, String homePath) {
        this.provider = provider;
        this.accountLabel = accountLabel;
        this.homePath = homePath;
        this.status = ProviderConnectionStatus.ACTIVE;
    }

    public Long getId() {
        return id;
    }

    public ProviderType getProvider() {
        return provider;
    }

    public String getAccountLabel() {
        return accountLabel;
    }

    public String getHomePath() {
        return homePath;
    }

    public ProviderConnectionStatus getStatus() {
        return status;
    }

    public Instant getLastImportAt() {
        return lastImportAt;
    }

    public String getLastErrorMessage() {
        return lastErrorMessage;
    }

    public void markImported() {
        this.status = ProviderConnectionStatus.ACTIVE;
        this.lastImportAt = Instant.now();
        this.lastErrorMessage = null;
    }
}
