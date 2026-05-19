package com.jean325.threadkeeper.snapshot.domain;

import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ThreadSnapshotRepository extends JpaRepository<ThreadSnapshot, Long> {
    List<ThreadSnapshot> findAllByThreadIdOrderByCreatedAtDesc(Long threadId);
    Optional<ThreadSnapshot> findFirstByThreadIdOrderByCreatedAtDesc(Long threadId);
}
