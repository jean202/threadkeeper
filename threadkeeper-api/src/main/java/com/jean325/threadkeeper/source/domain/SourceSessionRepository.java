package com.jean325.threadkeeper.source.domain;

import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SourceSessionRepository extends JpaRepository<SourceSession, Long> {
    List<SourceSession> findAllByThreadIdOrderByImportedAtDesc(Long threadId);
    Optional<SourceSession> findFirstByThreadIdOrderByImportedAtDesc(Long threadId);
    Optional<SourceSession> findByProviderConnectionIdAndProviderSessionKey(Long providerConnectionId, String providerSessionKey);
    List<SourceSession> findAllByProviderConnectionId(Long providerConnectionId);
    long countByThreadIdAndProviderConnectionIdNot(Long threadId, Long providerConnectionId);
    long countByProviderConnectionId(Long providerConnectionId);
    void deleteAllByProviderConnectionId(Long providerConnectionId);
}
