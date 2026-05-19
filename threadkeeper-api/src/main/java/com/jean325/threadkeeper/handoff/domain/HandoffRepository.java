package com.jean325.threadkeeper.handoff.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HandoffRepository extends JpaRepository<Handoff, Long> {
    List<Handoff> findAllByThreadIdOrderByCreatedAtDesc(Long threadId);
}
