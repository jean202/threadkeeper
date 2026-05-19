package com.jean325.threadkeeper.notification.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
