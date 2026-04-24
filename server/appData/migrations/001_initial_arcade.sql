-- Arcade-first schema (fresh installs). Replaces legacy 002/003 migrations.
PRAGMA foreign_keys = ON;

CREATE TABLE settings (
    settingsId INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL UNIQUE,
    config JSON NOT NULL,
    description TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    messageId INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    timestampResult TIMESTAMP,
    origin TEXT,
    userId TEXT NOT NULL,
    source TEXT,
    payloadToolkit TEXT NOT NULL DEFAULT '',
    payloadToolVersion TEXT NOT NULL DEFAULT '',
    payloadMessageId TEXT NOT NULL DEFAULT '',
    payloadMethod TEXT,
    payloadToolName TEXT,
    payloadParams TEXT,
    payloadResult TEXT,
    payloadError TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE policies (
    policyId INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    severity INTEGER NOT NULL,
    origin TEXT DEFAULT 'either',
    methods JSON,
    conditions JSON,
    actions JSON,
    enabled BOOLEAN DEFAULT 1,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerts (
    alertId INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId INTEGER NOT NULL,
    policyId INTEGER NOT NULL,
    origin TEXT NOT NULL,
    condition JSON NOT NULL,
    findings JSON NOT NULL,
    conditionName TEXT GENERATED ALWAYS AS (json_extract(condition, '$.name')) VIRTUAL,
    timestamp TIMESTAMP NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seenAt TIMESTAMP,
    FOREIGN KEY (messageId) REFERENCES messages(messageId) ON DELETE CASCADE,
    FOREIGN KEY (policyId) REFERENCES policies(policyId) ON DELETE CASCADE
);

CREATE TABLE message_actions (
    messageActionId INTEGER PRIMARY KEY AUTOINCREMENT,
    messageId INTEGER NOT NULL,
    policyId INTEGER NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN ('client', 'server')),
    severity INTEGER NOT NULL,
    action JSON NOT NULL,
    actionEvents JSON NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (messageId) REFERENCES messages(messageId) ON DELETE CASCADE,
    FOREIGN KEY (policyId) REFERENCES policies(policyId) ON DELETE CASCADE
);

CREATE TABLE policy_elements (
    configId INTEGER PRIMARY KEY AUTOINCREMENT,
    className TEXT NOT NULL,
    elementType TEXT NOT NULL CHECK (elementType IN ('condition', 'action')),
    label TEXT,
    config JSON,
    enabled BOOLEAN DEFAULT 1,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO policy_elements (className, elementType)
VALUES
    ('regex', 'condition'),
    ('rewrite', 'action'),
    ('error', 'action');

CREATE INDEX idx_messages_message_id ON messages(messageId);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_payload_message_id ON messages(payloadMessageId);
CREATE INDEX idx_messages_tool_name ON messages(payloadToolName);
CREATE INDEX idx_messages_source ON messages(source);
CREATE INDEX idx_messages_payload_toolkit ON messages(payloadToolkit);

CREATE INDEX idx_alerts_message_id ON alerts(messageId);
CREATE INDEX idx_alerts_policy_id ON alerts(policyId);
CREATE INDEX idx_alerts_created_at ON alerts(createdAt);
CREATE INDEX idx_alerts_seen_at ON alerts(seenAt);
CREATE INDEX idx_alerts_timestamp ON alerts(timestamp);
CREATE INDEX idx_alerts_condition_name ON alerts(conditionName);

CREATE INDEX idx_message_actions_message_id ON message_actions(messageId);
CREATE INDEX idx_message_actions_policy_id ON message_actions(policyId);
CREATE INDEX idx_message_actions_origin ON message_actions(origin);
CREATE INDEX idx_message_actions_created_at ON message_actions(createdAt);

CREATE INDEX idx_policy_elements_element_type ON policy_elements(elementType);
CREATE INDEX idx_policy_elements_class_name ON policy_elements(className);
CREATE INDEX idx_policy_elements_enabled ON policy_elements(enabled);

CREATE TRIGGER update_settings_timestamp
AFTER UPDATE ON settings
BEGIN
    UPDATE settings SET updatedAt = CURRENT_TIMESTAMP
    WHERE settingsId = NEW.settingsId;
END;

CREATE TRIGGER update_policies_timestamp
AFTER UPDATE ON policies
BEGIN
    UPDATE policies SET updatedAt = CURRENT_TIMESTAMP
    WHERE policyId = NEW.policyId;
END;

CREATE TRIGGER update_policy_elements_timestamp
AFTER UPDATE ON policy_elements
BEGIN
    UPDATE policy_elements SET updatedAt = CURRENT_TIMESTAMP
    WHERE configId = NEW.configId;
END;
