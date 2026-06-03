package com.jean325.threadkeeper.portfolio.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.jean325.threadkeeper.portfolio.domain.PortfolioProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PortfolioScanFileReaderTest {

    @TempDir
    Path tempDir;

    private PortfolioScanFileReader readerFor(Path jsonPath) {
        PortfolioProperties props = new PortfolioProperties();
        props.setJsonPath(jsonPath.toString());
        return new PortfolioScanFileReader(props);
    }

    @Test
    void parsesProjectsFromValidFile() throws Exception {
        Path file = tempDir.resolve("scan.json");
        Files.writeString(file, """
                {"projects":[
                  {"name":"threadkeeper","readiness":82,"baseReadiness":71,"scannedAt":"2026-06-02T22:47:50.883Z"}
                ]}
                """);
        List<PortfolioScanEntry> entries = readerFor(file).read();
        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).name()).isEqualTo("threadkeeper");
        assertThat(entries.get(0).readiness()).isEqualTo(82);
        assertThat(entries.get(0).baseReadiness()).isEqualTo(71);
        assertThat(entries.get(0).scannedAt()).isEqualTo("2026-06-02T22:47:50.883Z");
    }

    @Test
    void returnsEmptyWhenFileMissing() {
        assertThat(readerFor(tempDir.resolve("nope.json")).read()).isEmpty();
    }

    @Test
    void returnsEmptyWhenJsonMalformed() throws Exception {
        Path file = tempDir.resolve("broken.json");
        Files.writeString(file, "{not json");
        assertThat(readerFor(file).read()).isEmpty();
    }

    @Test
    void returnsEmptyWhenPathBlank() {
        PortfolioProperties props = new PortfolioProperties();
        props.setJsonPath("");
        assertThat(new PortfolioScanFileReader(props).read()).isEmpty();
    }

    @Test
    void rereadsOnlyWhenMtimeChanges() throws Exception {
        Path file = tempDir.resolve("scan.json");
        Files.writeString(file, """
                {"projects":[{"name":"a","readiness":10,"baseReadiness":10,"scannedAt":"2026-06-02T00:00:00Z"}]}
                """);
        Files.setLastModifiedTime(file, FileTime.fromMillis(1_000_000L));
        PortfolioScanFileReader reader = readerFor(file);
        assertThat(reader.read().get(0).readiness()).isEqualTo(10);

        // Change content but KEEP same mtime -> cached value returned.
        Files.writeString(file, """
                {"projects":[{"name":"a","readiness":99,"baseReadiness":99,"scannedAt":"2026-06-02T00:00:00Z"}]}
                """);
        Files.setLastModifiedTime(file, FileTime.fromMillis(1_000_000L));
        assertThat(reader.read().get(0).readiness()).isEqualTo(10);

        // Bump mtime -> re-read.
        Files.setLastModifiedTime(file, FileTime.fromMillis(2_000_000L));
        assertThat(reader.read().get(0).readiness()).isEqualTo(99);
    }
}
