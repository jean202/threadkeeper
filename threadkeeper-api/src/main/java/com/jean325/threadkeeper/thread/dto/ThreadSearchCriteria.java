package com.jean325.threadkeeper.thread.dto;

import com.jean325.threadkeeper.provider.domain.ProviderType;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import com.jean325.threadkeeper.thread.domain.ThreadStatus;

/**
 * The filters PRD section 9 asks for: project, provider, status, priority,
 * keyword and recency. Every field is optional; all of them null means "list everything",
 * which is what the dashboard and the thread list still do.
 */
public record ThreadSearchCriteria(
        String projectKey,
        ProviderType provider,
        ThreadStatus status,
        ThreadPriority priority,
        String keyword,
        Integer activeWithinDays
) {
    public static ThreadSearchCriteria none() {
        return new ThreadSearchCriteria(null, null, null, null, null, null);
    }

    /** Blank strings arrive from empty form fields and must not filter anything out. */
    public ThreadSearchCriteria {
        projectKey = blankToNull(projectKey);
        keyword = blankToNull(keyword);
        if (activeWithinDays != null && activeWithinDays <= 0) {
            activeWithinDays = null;
        }
    }

    public boolean isEmpty() {
        return projectKey == null && provider == null && status == null
                && priority == null && keyword == null && activeWithinDays == null;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
