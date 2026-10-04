package com.jean325.threadkeeper.global.error;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Stopping Postgres (quitting Docker Desktop) has to read as "the database is
 * down", not as an anonymous 500. Standalone so it needs no database itself.
 */
class ApiExceptionHandlerDatabaseUnavailableTest {

    @RestController
    static class FailingController {
        @GetMapping("/no-transaction")
        String noTransaction() {
            throw new CannotCreateTransactionException("Could not open JPA EntityManager for transaction");
        }

        @GetMapping("/connection-lost")
        String connectionLost() {
            throw new DataAccessResourceFailureException("Connection to localhost:5432 refused");
        }
    }

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new FailingController())
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    void reportsAFailureToOpenATransactionAsServiceUnavailable() throws Exception {
        mockMvc.perform(get("/no-transaction"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DATABASE_UNAVAILABLE"));
    }

    @Test
    void reportsALostConnectionAsServiceUnavailable() throws Exception {
        mockMvc.perform(get("/connection-lost"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DATABASE_UNAVAILABLE"));
    }
}
