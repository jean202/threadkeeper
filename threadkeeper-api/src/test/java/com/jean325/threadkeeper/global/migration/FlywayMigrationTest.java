package com.jean325.threadkeeper.global.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The rest of the suite runs on {@code ddl-auto: create-drop} with Flyway off, so
 * the migrations are never executed and drift between the entities and
 * {@code db/migration} goes unnoticed until a real deployment.
 *
 * <p>This test closes that gap: it builds the schema from the migrations alone and
 * then runs Hibernate's {@code validate} against it. If an entity gains a field
 * with no matching migration -- or a migration disagrees on type or nullability --
 * the context fails to start and every test here fails with it.
 *
 * <p>Two deliberate differences from the shared test datasource:
 * <ul>
 *   <li>{@code DB_CLOSE_DELAY=-1}, so the in-memory database survives Flyway's
 *       connection returning to the pool. Without it the schema is discarded and
 *       Hibernate validates against nothing.</li>
 *   <li>no {@code DATABASE_TO_UPPER=false}. In that mode H2 reports
 *       storesLowerCase, storesUpperCase and storesMixedCase all false, and
 *       Hibernate's validator cannot work out which case to look up, so it
 *       reports every table as missing. H2's default casing answers consistently.</li>
 * </ul>
 *
 * <p>It runs on H2 in PostgreSQL mode rather than real Postgres, so it catches
 * missing and mistyped columns but not Postgres-specific SQL. Covering that needs
 * Testcontainers and a Docker daemon.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.datasource.hikari.jdbc-url=jdbc:h2:mem:threadkeeper-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
})
class FlywayMigrationTest {

    @Autowired
    private DataSource dataSource;

    @Test
    void everyMigrationAppliesAndTheEntitiesValidateAgainstTheResultingSchema() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);

        // Flyway creates its history table and columns as quoted lower-case
        // identifiers, so both must be quoted here or they fold to upper case and
        // fail to resolve. Discover the table name rather than assuming its case.
        String history = rawTableNames().stream()
                .filter(name -> name.equalsIgnoreCase("flyway_schema_history"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Flyway did not create a history table; migrations never ran"));

        Integer applied = jdbc.queryForObject(
                "select count(*) from \"" + history + "\" where \"success\" = true", Integer.class);
        assertThat(applied)
                .as("every migration in db/migration should have applied")
                .isNotNull()
                .isGreaterThanOrEqualTo(2);

        Integer failed = jdbc.queryForObject(
                "select count(*) from \"" + history + "\" where \"success\" = false", Integer.class);
        assertThat(failed).isZero();
    }

    @Test
    void theSchemaTheMigrationsProduceContainsTheCoreTables() {
        // Read through JDBC metadata rather than information_schema so the
        // assertion does not depend on the database's identifier casing.
        assertThat(tableNames())
                .contains("threads", "provider_connections", "source_sessions",
                        "thread_snapshots", "handoffs", "notification_rules", "notification_events");
    }

    @Test
    void theDriftScoreColumnAddedByV2Exists() {
        // Spot-check that the latest migration took effect, rather than trusting
        // the history table alone.
        assertThat(columnNames("threads")).contains("drift_score");
    }

    private List<String> tableNames() {
        return readMetadata(true, null).stream().map(name -> name.toLowerCase(Locale.ROOT)).toList();
    }

    /** Table names exactly as the database stores them, for use in quoted SQL. */
    private List<String> rawTableNames() {
        return readMetadata(true, null);
    }

    private List<String> columnNames(String table) {
        return readMetadata(false, table).stream().map(name -> name.toLowerCase(Locale.ROOT)).toList();
    }

    private List<String> readMetadata(boolean tables, String table) {
        List<String> names = new ArrayList<>();
        try (Connection connection = dataSource.getConnection()) {
            var metaData = connection.getMetaData();
            try (ResultSet rs = tables
                    ? metaData.getTables(null, null, "%", new String[]{"TABLE"})
                    : metaData.getColumns(null, null, table.toUpperCase(Locale.ROOT), "%")) {
                while (rs.next()) {
                    names.add(rs.getString(tables ? "TABLE_NAME" : "COLUMN_NAME"));
                }
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Could not read schema metadata", ex);
        }
        return names;
    }
}
