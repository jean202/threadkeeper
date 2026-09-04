package com.jean325.threadkeeper.source.domain;

import java.util.Optional;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SourceSessionRepository extends JpaRepository<SourceSession, Long> {
    List<SourceSession> findAllByThreadIdOrderByImportedAtDesc(Long threadId);
    Optional<SourceSession> findFirstByThreadIdOrderByImportedAtDesc(Long threadId);
    Optional<SourceSession> findByProviderConnectionIdAndProviderSessionKey(Long providerConnectionId, String providerSessionKey);
    List<SourceSession> findAllByProviderConnectionId(Long providerConnectionId);
    long countByThreadIdAndProviderConnectionIdNot(Long threadId, Long providerConnectionId);
    long countByProviderConnectionId(Long providerConnectionId);

    /** Newest first. Pass a Pageable to cap it, so a large import is not loaded whole. */
    List<SourceSession> findAllByProviderConnectionIdOrderByImportedAtDesc(
            Long providerConnectionId, Pageable pageable);

    /** Sessions may be unlinked or share a thread, so this is not the session count. */
    @Query("""
            select count(distinct s.thread.id) from SourceSession s
            where s.providerConnection.id = :connectionId
            """)
    long countDistinctThreadsByProviderConnectionId(@Param("connectionId") Long connectionId);
    void deleteAllByProviderConnectionId(Long providerConnectionId);
}
