-- Arcade-first schema (fresh installs). Auth + multi-tenant columns.
PRAGMA foreign_keys = ON;

CREATE TABLE tenants (
    tenantId INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tenants (tenantId, name, slug) VALUES (1, 'Default', 'default');

CREATE TABLE users (
    userId INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId INTEGER NOT NULL,
    email TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenantId) REFERENCES tenants (tenantId),
    UNIQUE (tenantId, email)
);

CREATE TABLE tenant_api_keys (
    keyId INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId INTEGER NOT NULL,
    keyLookupId TEXT NOT NULL UNIQUE,
    name TEXT,
    secretHash TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revokedAt TIMESTAMP,
    FOREIGN KEY (tenantId) REFERENCES tenants (tenantId)
);

CREATE INDEX idx_tenant_api_keys_lookup ON tenant_api_keys (keyLookupId);

CREATE TABLE settings (
    settingsId INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId INTEGER NOT NULL,
    category TEXT NOT NULL,
    config JSON NOT NULL,
    description TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenantId) REFERENCES tenants (tenantId),
    UNIQUE (tenantId, category)
);

CREATE TABLE messages (
    messageId INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId INTEGER NOT NULL,
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
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenantId) REFERENCES tenants (tenantId)
);

CREATE TABLE policies (
    policyId INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    severity INTEGER NOT NULL,
    origin TEXT DEFAULT 'either',
    matchToolkit TEXT,
    matchTool TEXT,
    conditions JSON,
    actions JSON,
    enabled BOOLEAN DEFAULT 1,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenantId) REFERENCES tenants (tenantId)
);

CREATE TABLE alerts (
    alertId INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId INTEGER NOT NULL,
    messageId INTEGER NOT NULL,
    policyId INTEGER NOT NULL,
    origin TEXT NOT NULL,
    condition JSON NOT NULL,
    findings JSON NOT NULL,
    conditionName TEXT GENERATED ALWAYS AS (json_extract(condition, '$.name')) VIRTUAL,
    timestamp TIMESTAMP NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seenAt TIMESTAMP,
    FOREIGN KEY (messageId) REFERENCES messages (messageId) ON DELETE CASCADE,
    FOREIGN KEY (policyId) REFERENCES policies (policyId) ON DELETE CASCADE,
    FOREIGN KEY (tenantId) REFERENCES tenants (tenantId)
);

CREATE TABLE message_actions (
    messageActionId INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId INTEGER NOT NULL,
    messageId INTEGER NOT NULL,
    policyId INTEGER NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN ('client', 'server')),
    severity INTEGER NOT NULL,
    action JSON NOT NULL,
    actionEvents JSON NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (messageId) REFERENCES messages (messageId) ON DELETE CASCADE,
    FOREIGN KEY (policyId) REFERENCES policies (policyId) ON DELETE CASCADE,
    FOREIGN KEY (tenantId) REFERENCES tenants (tenantId)
);

CREATE TABLE policy_elements (
    configId INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId INTEGER NOT NULL,
    className TEXT NOT NULL,
    elementType TEXT NOT NULL CHECK (elementType IN ('condition', 'action')),
    label TEXT,
    config JSON,
    enabled BOOLEAN DEFAULT 1,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenantId) REFERENCES tenants (tenantId)
);

INSERT INTO policy_elements (tenantId, className, elementType)
VALUES
    (1, 'regex', 'condition'),
    (1, 'rewrite', 'action'),
    (1, 'error', 'action');

CREATE INDEX idx_messages_tenant_id ON messages (tenantId);
CREATE INDEX idx_messages_message_id ON messages (messageId);
CREATE INDEX idx_messages_timestamp ON messages (timestamp);
CREATE INDEX idx_messages_payload_message_id ON messages (payloadMessageId);
CREATE INDEX idx_messages_tool_name ON messages (payloadToolName);
CREATE INDEX idx_messages_source ON messages (source);
CREATE INDEX idx_messages_payload_toolkit ON messages (payloadToolkit);

CREATE INDEX idx_policies_tenant_id ON policies (tenantId);

CREATE INDEX idx_alerts_tenant_id ON alerts (tenantId);
CREATE INDEX idx_alerts_message_id ON alerts (messageId);
CREATE INDEX idx_alerts_policy_id ON alerts (policyId);
CREATE INDEX idx_alerts_created_at ON alerts (createdAt);
CREATE INDEX idx_alerts_seen_at ON alerts (seenAt);
CREATE INDEX idx_alerts_timestamp ON alerts (timestamp);
CREATE INDEX idx_alerts_condition_name ON alerts (conditionName);

CREATE INDEX idx_message_actions_tenant_id ON message_actions (tenantId);
CREATE INDEX idx_message_actions_message_id ON message_actions (messageId);
CREATE INDEX idx_message_actions_policy_id ON message_actions (policyId);
CREATE INDEX idx_message_actions_origin ON message_actions (origin);
CREATE INDEX idx_message_actions_created_at ON message_actions (createdAt);

CREATE INDEX idx_policy_elements_tenant_id ON policy_elements (tenantId);
CREATE INDEX idx_policy_elements_element_type ON policy_elements (elementType);
CREATE INDEX idx_policy_elements_class_name ON policy_elements (className);
CREATE INDEX idx_policy_elements_enabled ON policy_elements (enabled);

CREATE INDEX idx_settings_tenant_id ON settings (tenantId);

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
