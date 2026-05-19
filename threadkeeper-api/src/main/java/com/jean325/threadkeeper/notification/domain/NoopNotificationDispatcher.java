package com.jean325.threadkeeper.notification.domain;

import org.springframework.stereotype.Component;

@Component
public class NoopNotificationDispatcher implements NotificationChannelDispatcher {

    @Override
    public boolean supports(NotificationChannel channel) {
        return channel == NotificationChannel.DESKTOP || channel == NotificationChannel.EMAIL;
    }

    @Override
    public void dispatch(NotificationEvent event) {
        // Placeholder for desktop and email adapters.
    }
}
