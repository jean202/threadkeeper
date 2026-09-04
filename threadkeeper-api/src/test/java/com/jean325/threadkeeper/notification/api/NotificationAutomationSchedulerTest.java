package com.jean325.threadkeeper.notification.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jean325.threadkeeper.notification.application.NotificationAutomationScheduler;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "threadkeeper.notifications.scheduler.enabled=true")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class NotificationAutomationSchedulerTest {

    private static HttpServer server;
    private static final AtomicReference<String> lastBody = new AtomicReference<>("");

    @BeforeAll
    static void setUpServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/discord", NotificationAutomationSchedulerTest::handleExchange);
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

    @Autowired
    private NotificationAutomationScheduler notificationAutomationScheduler;

    @Test
    void schedulerEvaluatesAndDispatchesQueuedNotifications() throws Exception {
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
                                  "title": "Scheduler target",
                                  "priority": "HIGH",
                                  "originalIntent": "Auto queue and dispatch notification.",
                                  "todayGoal": "Run scheduler.",
                                  "doneCondition": "Event is sent."
                                }
                                """))
                .andExpect(status().isCreated());

        notificationAutomationScheduler.evaluateRules();
        notificationAutomationScheduler.dispatchQueuedNotifications();

        mockMvc.perform(get("/api/v1/notification-events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].eventType").value("INACTIVITY"))
                .andExpect(jsonPath("$[0].deliveryStatus").value("SENT"));

        // The scheduler's job is to get a readable reminder out, so check the
        // rendered body rather than the internal payload behind it.
        String sent = lastBody.get();
        Assertions.assertTrue(sent.contains("Idle"), sent);
        Assertions.assertFalse(sent.contains("payload="), sent);
    }

    private static void handleExchange(HttpExchange exchange) throws IOException {
        byte[] requestBytes = exchange.getRequestBody().readAllBytes();
        lastBody.set(new String(requestBytes, StandardCharsets.UTF_8));
        exchange.sendResponseHeaders(204, -1);
        try (OutputStream ignored = exchange.getResponseBody()) {
            // no body
        }
    }
}
