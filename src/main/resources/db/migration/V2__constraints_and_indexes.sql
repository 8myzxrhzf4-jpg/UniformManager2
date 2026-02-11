-- V2__constraints_and_indexes.sql: Add constraints and indexes
-- Backfills null values, adds NOT NULL constraints, and creates additional indexes

-- Backfill NULL values in uniform_items
UPDATE uniform_items SET status = 'In Stock' WHERE status IS NULL;
UPDATE uniform_items SET category = 'Other' WHERE category IS NULL;

-- Add NOT NULL constraints to status and category
ALTER TABLE uniform_items MODIFY status VARCHAR(50) NOT NULL;
ALTER TABLE uniform_items MODIFY category VARCHAR(100) NOT NULL;

-- Add unique index on uniform_items.barcode
CREATE UNIQUE INDEX idx_uniform_items_barcode_unique ON uniform_items(barcode);

-- Add index on audit_entries.created_at for better query performance
CREATE INDEX idx_audit_entries_created_at ON audit_entries(created_at);
