package com.jean325.threadkeeper.thread.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ThreadRepository extends JpaRepository<Thread, Long> {
    List<Thread> findAllByOrderByLastActivityAtDesc();
    Thread findTopByTitleIgnoreCaseOrderByLastActivityAtDesc(String title);
    Thread findTopByTitleIgnoreCaseAndStatusOrderByLastActivityAtDesc(String title, ThreadStatus status);
    Thread findTopByProjectKeyIgnoreCaseAndTitleIgnoreCaseAndStatusOrderByLastActivityAtDesc(
            String projectKey,
            String title,
            ThreadStatus status
    );
}
