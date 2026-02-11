-- V1__init.sql: Initial schema for UniformManager2
-- Creates core tables for cities, studios, game presenters, uniform items, assignments, laundry orders, and audit entries

-- Cities table
CREATE TABLE cities (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- Studio table
CREATE TABLE studio (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    hamper_capacity INT NOT NULL DEFAULT 50,
    current_hamper_count INT NOT NULL DEFAULT 0,
    city_id BIGINT,
    CONSTRAINT fk_studio_city FOREIGN KEY (city_id) REFERENCES cities(id)
);

-- Game presenters table
CREATE TABLE game_presenters (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    barcode VARCHAR(255) UNIQUE
);

-- Uniform items table
CREATE TABLE uniform_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    size VARCHAR(50),
    barcode VARCHAR(255),
    status VARCHAR(50),
    category VARCHAR(100),
    studio_id BIGINT,
    studio_location VARCHAR(255),
    CONSTRAINT fk_uniform_items_studio FOREIGN KEY (studio_id) REFERENCES studio(id)
);

-- Assignments table
CREATE TABLE assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    gp_name VARCHAR(255),
    item_name VARCHAR(255),
    size VARCHAR(50),
    date TIMESTAMP,
    item_barcode VARCHAR(255),
    studio VARCHAR(255)
);

-- Laundry orders table
CREATE TABLE laundry_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL UNIQUE,
    origin_studio VARCHAR(255),
    destination_studio VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'PENDING'
);

-- Laundry order items table
CREATE TABLE laundry_order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    laundry_order_id BIGINT NOT NULL,
    item_barcode VARCHAR(255),
    item_name VARCHAR(255),
    CONSTRAINT fk_laundry_items_order FOREIGN KEY (laundry_order_id) REFERENCES laundry_orders(id) ON DELETE CASCADE
);

-- Audit entries table
CREATE TABLE audit_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id BIGINT,
    entity_type VARCHAR(100),
    entity_id BIGINT
);

-- Indexes for performance
CREATE INDEX idx_studio_city ON studio(city_id);
CREATE INDEX idx_uniform_items_studio ON uniform_items(studio_id);
CREATE INDEX idx_uniform_items_status ON uniform_items(status);
CREATE INDEX idx_assignments_gp_name ON assignments(gp_name);
CREATE INDEX idx_assignments_item_barcode ON assignments(item_barcode);
CREATE INDEX idx_laundry_orders_origin ON laundry_orders(origin_studio);
CREATE INDEX idx_laundry_orders_status ON laundry_orders(status);
CREATE INDEX idx_laundry_order_items_order ON laundry_order_items(laundry_order_id);
CREATE INDEX idx_audit_entries_entity ON audit_entries(entity_type, entity_id);
