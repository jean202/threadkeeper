package com.jean325.threadkeeper.notification.domain;

public interface NotificationChannelDispatcher {
    boolean supports(NotificationChannel channel);
    void dispatch(NotificationEvent event);
}
