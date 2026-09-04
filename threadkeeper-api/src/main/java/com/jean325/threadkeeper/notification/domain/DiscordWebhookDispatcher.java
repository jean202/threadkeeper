package com.jean325.threadkeeper.notification.domain;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DiscordWebhookDispatcher implements NotificationChannelDispatcher {

    private final NotificationProperties notificationProperties;
    private final ObjectMapper objectMapper;
    private final NotificationMessageComposer messageComposer;
    private final HttpClient httpClient;

    public DiscordWebhookDispatcher(
            NotificationProperties notificationProperties,
            ObjectMapper objectMapper,
            NotificationMessageComposer messageComposer
    ) {
        this.notificationProperties = notificationProperties;
        this.objectMapper = objectMapper;
        this.messageComposer = messageComposer;
        this.httpClient = HttpClient.newHttpClient();
    }

    @Override
    public boolean supports(NotificationChannel channel) {
        return channel == NotificationChannel.DISCORD;
    }

    @Override
    public void dispatch(NotificationEvent event) {
        String webhookUrl = notificationProperties.getDiscord().getWebhookUrl();
        if (webhookUrl == null || webhookUrl.isBlank()) {
            throw new IllegalStateException("Discord webhook URL is not configured.");
        }

        try {
            String body = objectMapper.writeValueAsString(Map.of("content", messageComposer.compose(event)));
            HttpRequest request = HttpRequest.newBuilder(URI.create(webhookUrl))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException(
                        "Discord webhook failed with status " + response.statusCode() + ": " + response.body()
                );
            }
        } catch (IOException | InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Discord webhook dispatch failed: " + ex.getMessage(), ex);
        }
    }
}
