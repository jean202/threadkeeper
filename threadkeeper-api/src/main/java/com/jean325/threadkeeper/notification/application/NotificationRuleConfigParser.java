package com.jean325.threadkeeper.notification.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jean325.threadkeeper.global.error.ApiException;
import com.jean325.threadkeeper.notification.domain.NotificationRuleConfig;
import com.jean325.threadkeeper.thread.domain.DriftStatus;
import com.jean325.threadkeeper.thread.domain.ThreadPriority;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class NotificationRuleConfigParser {

    private final ObjectMapper objectMapper;

    public NotificationRuleConfigParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public NotificationRuleConfig parse(String configJson) {
        if (configJson == null || configJson.isBlank()) {
            return NotificationRuleConfig.empty();
        }

        try {
            JsonNode root = objectMapper.readTree(configJson);
            return new NotificationRuleConfig(
                    readStringSet(root, "projectKeys"),
                    readStringSet(root, "excludeProjectKeys"),
                    readEnum(root, "minimumPriority", ThreadPriority.class),
                    readInteger(root, "cooldownMinutes"),
                    readInteger(root, "topN"),
                    readInteger(root, "staleMinutes"),
                    root.path("onlyIfMissingNextAction").asBoolean(false),
                    readEnumList(root, "driftStatuses", DriftStatus.class)
            );
        } catch (IOException ex) {
            throw new ApiException("INVALID_NOTIFICATION_RULE_CONFIG", "configJson must be valid JSON.", HttpStatus.BAD_REQUEST);
        } catch (IllegalArgumentException ex) {
            throw new ApiException("INVALID_NOTIFICATION_RULE_CONFIG", ex.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    public void validate(String configJson) {
        parse(configJson);
    }

    private Set<String> readStringSet(JsonNode root, String field) {
        JsonNode node = root.path(field);
        if (node.isMissingNode() || node.isNull()) {
            return Set.of();
        }
        if (!node.isArray()) {
            throw new IllegalArgumentException(field + " must be an array of strings.");
        }
        Set<String> values = new LinkedHashSet<>();
        for (JsonNode child : node) {
            if (!child.isTextual()) {
                throw new IllegalArgumentException(field + " must contain only strings.");
            }
            values.add(child.asText());
        }
        return values;
    }

    private Integer readInteger(JsonNode root, String field) {
        JsonNode node = root.path(field);
        if (node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (!node.canConvertToInt()) {
            throw new IllegalArgumentException(field + " must be an integer.");
        }
        return node.asInt();
    }

    private <E extends Enum<E>> E readEnum(JsonNode root, String field, Class<E> type) {
        JsonNode node = root.path(field);
        if (node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (!node.isTextual()) {
            throw new IllegalArgumentException(field + " must be a string.");
        }
        return Enum.valueOf(type, node.asText());
    }

    private <E extends Enum<E>> List<E> readEnumList(JsonNode root, String field, Class<E> type) {
        JsonNode node = root.path(field);
        if (node.isMissingNode() || node.isNull()) {
            return List.of();
        }
        if (!node.isArray()) {
            throw new IllegalArgumentException(field + " must be an array.");
        }
        List<E> values = new ArrayList<>();
        for (JsonNode child : node) {
            if (!child.isTextual()) {
                throw new IllegalArgumentException(field + " must contain only strings.");
            }
            values.add(Enum.valueOf(type, child.asText()));
        }
        return values;
    }
}
