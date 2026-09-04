package com.jean325.threadkeeper.notification.api;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import java.time.LocalTime;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class NotificationEventControllerTest {

    private static HttpServer server;
    private static final AtomicReference<String> lastBody = new AtomicReference<>("");

    @BeforeAll
    static void setUpServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/discord", NotificationEventControllerTest::handleExchange);
        server.start();
    }

    @AfterAll
    static void tearDownServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add(
                "threadkeeper.notifications.discord.webhook-url",
                () -> "http://127.0.0.1:" + server.getAddress().getPort() + "/discord"
        );
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void queuesAndDispatchesCompletionNotifications() throws Exception {
        mockMvc.perform(post("/api/v1/notification-rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "ruleType": "COMPLETION",
                                  "enabled": true,
                                  "channel": "DISCORD",
                                  "thresholdMinutes": null,
                                  "scheduledTime": null,
                                  "configJson": "{}"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "Notify completion",
                                  "priority": "HIGH",
                                  "originalIntent": "Queue completion notification.",
                                  "todayGoal": "Complete thread.",
                                  "doneCondition": "Notification event exists."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(patch("/api/v1/threads/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "status": "COMPLETED"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/notification-events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].deliveryStatus").value("QUEUED"));

        mockMvc.perform(post("/api/v1/notification-events/dispatch"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dispatchedCount").value(1));

        mockMvc.perform(get("/api/v1/notification-events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].deliveryStatus").value("SENT"));

        // The webhook body is what a person reads, so assert on that rather than
        // on the internal payload the message is built from.
        String sent = lastBody.get();
        org.junit.jupiter.api.Assertions.assertTrue(sent.contains("Completed"), sent);
        org.junit.jupiter.api.Assertions.assertTrue(sent.contains("Notify completion"), sent);
        org.junit.jupiter.api.Assertions.assertTrue(sent.contains("Follow-up"), sent);
        org.junit.jupiter.api.Assertions.assertFalse(sent.contains("payload="), sent);
    }

    @Test
    void evaluatesInactivityRulesAndQueuesEvents() throws Exception {
        mockMvc.perform(post("/api/v1/notification-rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "ruleType": "INACTIVITY",
                                  "enabled": true,
                                  "channel": "DISCORD",
                                  "thresholdMinutes": 0,
                                  "scheduledTime": null,
                                  "configJson": "{}"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "Inactivity target",
                                  "priority": "HIGH",
                                  "originalIntent": "Queue inactivity alert.",
                                  "todayGoal": "Evaluate rules.",
                                  "doneCondition": "Queued event exists."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/notification-events/evaluate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.queuedCount").value(1));

        mockMvc.perform(post("/api/v1/notification-events/evaluate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.queuedCount").value(0));

        mockMvc.perform(get("/api/v1/notification-events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].eventType").value("INACTIVITY"));
    }

    @Test
    void evaluatesDailyBriefingRulesOnlyOncePerDay() throws Exception {
        String scheduledTime = LocalTime.now(ZoneId.of("Asia/Seoul")).withSecond(0).withNano(0).toString();

        mockMvc.perform(post("/api/v1/notification-rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "ruleType": "DAILY_BRIEFING",
                                  "enabled": true,
                                  "channel": "DISCORD",
                                  "thresholdMinutes": null,
                                  "scheduledTime": "%s",
                                  "configJson": "{}"
                                }
                                """.formatted(scheduledTime)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "Briefing target",
                                  "priority": "HIGH",
                                  "originalIntent": "Queue daily briefing.",
                                  "todayGoal": "Evaluate briefing rules.",
                                  "doneCondition": "Queued briefing event exists."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/notification-events/evaluate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.queuedCount").value(1));

        mockMvc.perform(post("/api/v1/notification-events/evaluate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.queuedCount").value(0));

        mockMvc.perform(get("/api/v1/notification-events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].eventType").value("DAILY_BRIEFING"));
    }

    @Test
    void evaluatesDailyBriefingRulesWithConfigScopeAndTopN() throws Exception {
        String scheduledTime = LocalTime.now(ZoneId.of("Asia/Seoul")).withSecond(0).withNano(0).toString();

        mockMvc.perform(post("/api/v1/notification-rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "ruleType": "DAILY_BRIEFING",
                                  "enabled": true,
                                  "channel": "DISCORD",
                                  "thresholdMinutes": null,
                                  "scheduledTime": "%s",
                                  "configJson": "{\\"projectKeys\\":[\\"threadkeeper\\"],\\"minimumPriority\\":\\"HIGH\\",\\"topN\\":1}"
                                }
                                """.formatted(scheduledTime)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "High priority briefing target",
                                  "priority": "HIGH",
                                  "originalIntent": "Queue only the top briefing item.",
                                  "todayGoal": "Evaluate briefing rule config.",
                                  "doneCondition": "Only one event is queued."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "other-project",
                                  "title": "Out of scope target",
                                  "priority": "HIGH",
                                  "originalIntent": "Should not match project scope.",
                                  "todayGoal": "Be filtered out.",
                                  "doneCondition": "No event is queued for this thread."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "Lower priority target",
                                  "priority": "MEDIUM",
                                  "originalIntent": "Should be filtered by minimum priority.",
                                  "todayGoal": "Be filtered out.",
                                  "doneCondition": "No event is queued for this thread."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/notification-events/evaluate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.queuedCount").value(1));

        mockMvc.perform(get("/api/v1/notification-events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].eventType").value("DAILY_BRIEFING"))
                .andExpect(jsonPath("$[0].payloadJson").value(org.hamcrest.Matchers.containsString("\"threadId\":1")));
    }

    private static void handleExchange(HttpExchange exchange) throws IOException {
        byte[] requestBytes = exchange.getRequestBody().readAllBytes();
        lastBody.set(new String(requestBytes, StandardCharsets.UTF_8));
        byte[] response = "{}".getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(204, -1);
        try (OutputStream ignored = exchange.getResponseBody()) {
            // no body
        }
    }
}
