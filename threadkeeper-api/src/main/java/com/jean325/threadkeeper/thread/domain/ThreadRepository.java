package com.jean325.threadkeeper.thread.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ThreadRepository extends JpaRepository<Thread, Long>, JpaSpecificationExecutor<Thread> {
    List<Thread> findAllByOrderByLastActivityAtDesc();
    Thread findTopByTitleIgnoreCaseOrderByLastActivityAtDesc(String title);
    Thread findTopByTitleIgnoreCaseAndStatusOrderByLastActivityAtDesc(String title, ThreadStatus status);
    Thread findTopByProjectKeyIgnoreCaseAndTitleIgnoreCaseAndStatusOrderByLastActivityAtDesc(
            String projectKey,
            String title,
            ThreadStatus status
    );

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    void deleteAllByIdIn(java.util.Collection<Long> ids);
}
