package com.jean325.threadkeeper.dashboard.application;

import com.jean325.threadkeeper.dashboard.dto.BriefingResponse;
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

        List<TodayDashboardResponse.DashboardThread> active = allThreads.stream()
                .filter(thread -> thread.getStatus() == ThreadStatus.ACTIVE)
                .map(thread -> toDashboardThread(thread, now))
                .toList();
        List<TodayDashboardResponse.DashboardThread> stale = active.stream()
                .filter(thread -> "STALE".equals(thread.resumeReason()))
                .toList();
        List<TodayDashboardResponse.DashboardThread> blocked = allThreads.stream()
                .filter(thread -> thread.getStatus() == ThreadStatus.BLOCKED || thread.getDriftStatus() == DriftStatus.BLOCKED)
                .map(thread -> toDashboardThread(thread, now))
                .toList();
        Instant startOfToday = ZonedDateTime.now(SEOUL).toLocalDate().atStartOfDay(SEOUL).toInstant();
        List<TodayDashboardResponse.DashboardThread> completedToday = allThreads.stream()
                .filter(thread -> thread.getStatus() == ThreadStatus.COMPLETED)
                .filter(thread -> thread.getCompletedAt() != null)
                .filter(thread -> thread.getCompletedAt().isAfter(startOfToday))
                .map(thread -> toDashboardThread(thread, now))
                .toList();
        List<Long> recommendedOrder = rankActiveThreads(allThreads).stream()
                .map(BriefingResponse.BriefingThread::threadId)
                .toList();

        return new TodayDashboardResponse(active, stale, blocked, completedToday, recommendedOrder);
    }

    public BriefingResponse briefing() {
        List<BriefingResponse.BriefingThread> ranked = rankActiveThreads(threadRepository.findAllByOrderByLastActivityAtDesc());
        String headline = ranked.isEmpty()
                ? "No active threads to resume"
                : "Resume the highest-signal threads first";
        return new BriefingResponse(headline, ranked.stream().limit(5).toList());
    }

    private List<BriefingResponse.BriefingThread> rankActiveThreads(List<Thread> allThreads) {
        Instant now = Instant.now();
        return allThreads.stream()
                .filter(thread -> thread.getStatus() == ThreadStatus.ACTIVE)
                .map(thread -> toBriefingThread(thread, now))
                .sorted(Comparator.comparingInt(BriefingResponse.BriefingThread::score).reversed()
                        .thenComparing(BriefingResponse.BriefingThread::lastActivityAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private BriefingResponse.BriefingThread toBriefingThread(Thread thread, Instant now) {
        long staleMinutes = computeStaleMinutes(thread, now);
        boolean missingNextAction = thread.getCurrentNextAction() == null || thread.getCurrentNextAction().isBlank();
        String resumeReason = inferResumeReason(thread, staleMinutes, missingNextAction);
        int score = score(thread, staleMinutes, missingNextAction);
        return new BriefingResponse.BriefingThread(
                thread.getId(),
                thread.getTitle(),
                thread.getPriority().name(),
                thread.getDriftStatus().name(),
                thread.getCurrentNextAction(),
                resumeReason,
                staleMinutes,
                score,
                thread.getLastActivityAt()
        );
    }

    private TodayDashboardResponse.DashboardThread toDashboardThread(Thread thread, Instant now) {
        long staleMinutes = computeStaleMinutes(thread, now);
        boolean missingNextAction = thread.getCurrentNextAction() == null || thread.getCurrentNextAction().isBlank();
        return new TodayDashboardResponse.DashboardThread(
                thread.getId(),
                thread.getProjectKey(),
                thread.getTitle(),
                thread.getStatus().name(),
                thread.getPriority().name(),
                thread.getDriftStatus().name(),
                thread.getCurrentNextAction(),
                inferResumeReason(thread, staleMinutes, missingNextAction),
                thread.getLastActivityAt() == null ? null : staleMinutes,
                thread.getLastActivityAt(),
                thread.getCompletedAt()
        );
    }

    private long computeStaleMinutes(Thread thread, Instant now) {
        if (thread.getLastActivityAt() == null) {
            return Long.MAX_VALUE;
        }
        return Math.max(Duration.between(thread.getLastActivityAt(), now).toMinutes(), 0);
    }

    private String inferResumeReason(Thread thread, long staleMinutes, boolean missingNextAction) {
        if (thread.getDriftStatus() == DriftStatus.BLOCKED) {
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
