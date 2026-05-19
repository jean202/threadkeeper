package com.jean325.threadkeeper.snapshot.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ThreadSnapshotControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createsSnapshotForThread() throws Exception {
        mockMvc.perform(post("/api/v1/threads")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "projectKey": "threadkeeper",
                                  "title": "Snapshot test",
                                  "priority": "HIGH",
                                  "originalIntent": "Track progress.",
                                  "todayGoal": "Create snapshot endpoint.",
                                  "doneCondition": "Snapshots persist."
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/threads/1/snapshots")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "snapshotType": "PROGRESS",
                                  "summary": "Built snapshot endpoint.",
                                  "nextAction": "Add notification rules.",
                                  "blockers": "",
                                  "driftScore": 5.50,
                                  "driftStatus": "ON_TRACK"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.snapshotType").value("PROGRESS"))
                .andExpect(jsonPath("$.summary").value("Built snapshot endpoint."));

        mockMvc.perform(get("/api/v1/threads/1/snapshots"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nextAction").value("Add notification rules."));
    }
}
