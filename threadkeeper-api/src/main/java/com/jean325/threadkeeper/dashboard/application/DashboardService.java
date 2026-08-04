package com.jean325.threadkeeper.dashboard.application;

import com.jean325.threadkeeper.dashboard.dto.BriefingResponse;
import com.jean325.threadkeeper.dashboard.dto.DashboardThread;
import com.jean325.threadkeeper.dashboard.dto.TodayDashboardResponse;
import com.jean325.threadkeeper.thread.domain.DriftStatus;
import com.jean325.threadkeeper.thread.domain.Thread;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import com.jean325.threadkeeper.thread.domain.ThreadRepository;
import com.jean325.threadkeeper.thread.domain.ThreadStatus;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {

    private static final Duration STALE_THRESHOLD = Duration.ofHours(6);
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final ThreadRepository threadRepository;

    public DashboardService(ThreadRepository threadRepository) {
        this.threadRepository = threadRepository;
    }

    public TodayDashboardResponse today() {
        Instant now = Instant.now();
        List<Thread> allThreads = threadRepository.findAllByOrderByLastActivityAtDesc();
        List<DashboardThread> active = rankActiveThreads(allThreads);
        List<DashboardThread> stale = active.stream()
                .filter(thread -> "STALE".equals(thread.resumeReason()))
                .toList();
        List<DashboardThread> blocked = allThreads.stream()
                .filter(thread -> thread.getStatus() == ThreadStatus.BLOCKED || thread.getDriftStatus() == DriftStatus.BLOCKED)
                .map(thread -> toDashboardThread(thread, now))
                .toList();
        Instant startOfToday = ZonedDateTime.now(SEOUL).toLocalDate().atStartOfDay(SEOUL).toInstant();
        List<DashboardThread> completedToday = allThreads.stream()
                .filter(thread -> thread.getStatus() == ThreadStatus.COMPLETED)
                .filter(thread -> thread.getCompletedAt() != null)
                .filter(thread -> thread.getCompletedAt().isAfter(startOfToday))
                .map(thread -> toDashboardThread(thread, now))
                .toList();

        return new TodayDashboardResponse(active, stale, blocked, completedToday, active);
    }

    public BriefingResponse briefing() {
        List<DashboardThread> ranked = rankActiveThreads(threadRepository.findAllByOrderByLastActivityAtDesc());
        String headline = ranked.isEmpty()
                ? "No active threads to resume"
                : "Resume the highest-signal threads first";
        return new BriefingResponse(headline, ranked.stream().limit(5).toList());
    }

    private List<DashboardThread> rankActiveThreads(List<Thread> allThreads) {
        Instant now = Instant.now();
        return allThreads.stream()
                .filter(thread -> thread.getStatus() == ThreadStatus.ACTIVE)
                .map(thread -> toDashboardThread(thread, now))
                .sorted(Comparator.comparingInt(DashboardThread::score).reversed()
                        .thenComparing(DashboardThread::lastActivityAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private DashboardThread toDashboardThread(Thread thread, Instant now) {
        long staleMinutes = computeStaleMinutes(thread, now);
        boolean missingNextAction = thread.getCurrentNextAction() == null || thread.getCurrentNextAction().isBlank();
        String resumeReason = inferResumeReason(thread, staleMinutes, missingNextAction);
        int score = score(thread, staleMinutes, missingNextAction);
        return new DashboardThread(
                thread.getId(),
                thread.getTitle(),
                thread.getPriority().name(),
                thread.getStatus().name(),
                thread.getDriftStatus().name(),
                thread.getCurrentNextAction(),
                resumeReason,
                staleMinutes,
                score,
                thread.getLastActivityAt()
        );
    }

    private long computeStaleMinutes(Thread thread, Instant now) {
        if (thread.getLastActivityAt() == null) {
            return Long.MAX_VALUE;
        }
        return Math.max(Duration.between(thread.getLastActivityAt(), now).toMinutes(), 0);
    }

    private String inferResumeReason(Thread thread, long staleMinutes, boolean missingNextAction) {
        if (thread.getStatus() == ThreadStatus.COMPLETED || thread.getDriftStatus() == DriftStatus.COMPLETED) {
            return "COMPLETED";
        }
        // Match how the blocked list itself is selected, otherwise a thread whose
        // status is BLOCKED reports "READY" in the blocked section.
        if (thread.getStatus() == ThreadStatus.BLOCKED || thread.getDriftStatus() == DriftStatus.BLOCKED) {
            return "BLOCKED";
        }
        if (thread.getDriftStatus() == DriftStatus.DRIFTING) {
            return "DRIFTING";
        }
        if (staleMinutes >= STALE_THRESHOLD.toMinutes()) {
            return "STALE";
        }
        if (missingNextAction) {
            return "MISSING_NEXT_ACTION";
        }
        if (thread.getPriority() == ThreadPriority.HIGH) {
            return "HIGH_PRIORITY";
        }
        return "READY";
    }

    private int score(Thread thread, long staleMinutes, boolean missingNextAction) {
        int score = switch (thread.getPriority()) {
            case HIGH -> 60;
            case MEDIUM -> 35;
            case LOW -> 20;
        };

        score += switch (thread.getDriftStatus()) {
            case BLOCKED -> 45;
            case DRIFTING -> 30;
            case ON_TRACK -> 0;
            case COMPLETED -> -100;
        };

        if (staleMinutes >= STALE_THRESHOLD.toMinutes()) {
            score += 25;
        } else if (staleMinutes >= 60) {
            score += 10;
        }

        if (missingNextAction) {
            score -= 15;
        } else {
            score += 10;
        }

        return score;
    }
}
