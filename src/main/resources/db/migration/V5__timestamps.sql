-- V5__timestamps.sql: Add updated_at columns and indexes
-- Adds updated_at timestamps to uniform_items and audit_entries for tracking modifications

-- Add updated_at column to uniform_items
ALTER TABLE uniform_items ADD COLUMN updated_at TIMESTAMP NULL;

-- Add updated_at column to audit_entries
ALTER TABLE audit_entries ADD COLUMN updated_at TIMESTAMP NULL;

-- Set initial values for updated_at (use created_at where available, or current timestamp)
UPDATE audit_entries SET updated_at = created_at WHERE updated_at IS NULL;

-- Add indexes on updated_at columns for better query performance
CREATE INDEX idx_uniform_items_updated_at ON uniform_items(updated_at);
CREATE INDEX idx_audit_entries_updated_at ON audit_entries(updated_at);
