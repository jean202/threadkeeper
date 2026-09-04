package com.jean325.threadkeeper.notification.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class NotificationRuleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void disablesARuleWithoutDeletingIt() throws Exception {
        createInactivityRule();

        mockMvc.perform(patch("/api/v1/notification-rules/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "enabled": false,
                                  "channel": "DESKTOP",
                                  "thresholdMinutes": 120,
                                  "scheduledTime": null,
                                  "configJson": "{}"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.channel").value("DESKTOP"))
                .andExpect(jsonPath("$.thresholdMinutes").value(120))
                // The rule type is fixed for the life of the rule.
                .andExpect(jsonPath("$.ruleType").value("INACTIVITY"));

        mockMvc.perform(get("/api/v1/notification-rules"))
                .andExpect(jsonPath("$[0].enabled").value(false));
    }

    @Test
    void aDisabledRuleStopsQueueingNotifications() throws Exception {
        createThread();
        createInactivityRule();

        // Enabled and past its threshold, the rule queues.
        mockMvc.perform(post("/api/v1/notification-events/evaluate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.queuedCount").value(1));

        mockMvc.perform(patch("/api/v1/notification-rules/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": false, "channel": "DISCORD", "thresholdMinutes": 0, "configJson": "{}"}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/notification-events/evaluate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.queuedCount").value(0));
    }

    @Test
    void deletingARuleAlsoDropsItsRecordedEvents() throws Exception {
        createThread();
        createInactivityRule();
        mockMvc.perform(post("/api/v1/notification-events/evaluate"))
                .andExpect(jsonPath("$.queuedCount").value(1));

        mockMvc.perform(delete("/api/v1/notification-rules/1"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/notification-rules"))
                .andExpect(jsonPath("$").isEmpty());
        // Events reference their rule, so they must go too rather than leaving a
        // dangling foreign key.
        mockMvc.perform(get("/api/v1/notification-events"))
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void rejectsUpdatingOrDeletingAnUnknownRule() throws Exception {
        mockMvc.perform(patch("/api/v1/notification-rules/999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": true, "channel": "DISCORD", "configJson": "{}"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOTIFICATION_RULE_NOT_FOUND"));

        mockMvc.perform(delete("/api/v1/notification-rules/999"))
                .andExpect(status().isNotFound());
    }

    private void createThread() throws Exception {
        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "Rule target",
                                  "priority": "MEDIUM",
                                  "originalIntent": "Something to notify about.",
                                  "todayGoal": "Move it.",
                                  "doneCondition": "Done."
                                }
                                """))
                .andExpect(status().isCreated());
    }

    /**
     * The point of the partial update: the settings screen flips one switch and
     * sends one field. Anything it did not send has to survive untouched.
     */
    @Test
    void togglingEnabledLeavesEveryOtherFieldAlone() throws Exception {
        createInactivityRule();

        mockMvc.perform(patch("/api/v1/notification-rules/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.channel").value("DISCORD"))
                .andExpect(jsonPath("$.thresholdMinutes").value(0))
                .andExpect(jsonPath("$.ruleType").value("INACTIVITY"));

        mockMvc.perform(get("/api/v1/notification-rules"))
                .andExpect(jsonPath("$[0].enabled").value(false))
                .andExpect(jsonPath("$[0].channel").value("DISCORD"))
                .andExpect(jsonPath("$[0].thresholdMinutes").value(0));
    }

    /**
     * An omitted "enabled" used to arrive as a primitive false and silently
     * disable the rule. Changing only the channel must not turn it off.
     */
    @Test
    void omittingEnabledDoesNotDisableTheRule() throws Exception {
        createInactivityRule();

        mockMvc.perform(patch("/api/v1/notification-rules/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"channel": "DESKTOP"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.channel").value("DESKTOP"));
    }

    @Test
    void anEmptyPatchChangesNothing() throws Exception {
        createInactivityRule();

        mockMvc.perform(patch("/api/v1/notification-rules/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.channel").value("DISCORD"))
                .andExpect(jsonPath("$.thresholdMinutes").value(0));
    }

    /** An omitted config is not an empty config, so it must not be validated. */
    @Test
    void omittingConfigJsonKeepsTheStoredConfig() throws Exception {
        mockMvc.perform(post("/api/v1/notification-rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "ruleType": "INACTIVITY",
                                  "enabled": true,
                                  "channel": "DISCORD",
                                  "thresholdMinutes": 30,
                                  "scheduledTime": null,
                                  "configJson": "{\\"projectKeys\\":[\\"threadkeeper\\"]}"
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(patch("/api/v1/notification-rules/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"enabled": false}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configJson").value("{\"projectKeys\":[\"threadkeeper\"]}"));
    }

    /** A config that is sent is still validated, partial update or not. */
    @Test
    void rejectsAnInvalidConfigThatWasActuallySent() throws Exception {
        createInactivityRule();

        mockMvc.perform(patch("/api/v1/notification-rules/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"configJson": "{\\"projectKeys\\": 5}"}
                                """))
                .andExpect(status().isBadRequest());
    }

    private void createInactivityRule() throws Exception {
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
    }

    @Test
    void createsNotificationRule() throws Exception {
        mockMvc.perform(post("/api/v1/notification-rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "ruleType": "INACTIVITY",
                                  "enabled": true,
                                  "channel": "DISCORD",
                                  "thresholdMinutes": 90,
                                  "scheduledTime": null,
                                  "configJson": "{\\"webhook\\":true}"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ruleType").value("INACTIVITY"));

        mockMvc.perform(get("/api/v1/notification-rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].channel").value("DISCORD"));
    }

    @Test
    void rejectsInvalidNotificationRuleConfig() throws Exception {
        mockMvc.perform(post("/api/v1/notification-rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "ruleType": "DRIFT_ALERT",
                                  "enabled": true,
                                  "channel": "DISCORD",
                                  "thresholdMinutes": null,
                                  "scheduledTime": null,
                                  "configJson": "{\\"minimumPriority\\":123}"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_NOTIFICATION_RULE_CONFIG"));
    }
}
