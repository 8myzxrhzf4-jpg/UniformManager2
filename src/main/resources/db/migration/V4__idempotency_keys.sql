-- V4__idempotency_keys.sql: Idempotency keys for API requests
-- Creates table to track idempotent operations and prevent duplicate processing

-- Idempotency keys table
CREATE TABLE idempotency_keys (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    handler VARCHAR(255) NOT NULL,
    request_payload TEXT,
    response_payload TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_idempotency_keys_handler ON idempotency_keys(handler);
CREATE INDEX idx_idempotency_keys_created_at ON idempotency_keys(created_at);
CREATE INDEX idx_idempotency_keys_status ON idempotency_keys(status);
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);
