-- V3__users_and_roles.sql: User management and roles
-- Creates roles, users, and user_roles tables with seed data

-- Roles table
CREATE TABLE roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
);

-- Users table
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- User roles junction table
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Seed roles
INSERT INTO roles (name, description) VALUES
    ('ADMIN', 'Administrator with full system access'),
    ('STAFF', 'Staff member with standard access'),
    ('AUDITOR', 'Auditor with read-only access for compliance');

-- Seed users with bcrypt hashed passwords
-- Note: These are bcrypt hashes for 'admin123', 'staff123', and 'auditor123' respectively
-- In production, these should be changed immediately
INSERT INTO users (username, password, email, full_name, enabled) VALUES
    ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin@uniformmanager.com', 'System Administrator', TRUE),
    ('staff', '$2a$10$EblZqNptyYvcLm9VfgbLqu1RlKYZLmZhUFqYwuW3FkCfQiWgKGbIS', 'staff@uniformmanager.com', 'Staff Member', TRUE),
    ('auditor', '$2a$10$F9BLdVJXfHYJ/zY8xXdJJuQKQAhLX/H2vZnZqX6NfYt1Y0KHv.yXK', 'auditor@uniformmanager.com', 'System Auditor', TRUE);

-- Assign roles to users
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'admin' AND r.name = 'ADMIN';

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'staff' AND r.name = 'STAFF';

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username = 'auditor' AND r.name = 'AUDITOR';

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_enabled ON users(enabled);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
