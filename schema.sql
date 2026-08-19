-- =============================================================================
-- Enterprise Visitor Management System (VMS) - PostgreSQL Database Schema
-- Server Target: 157.9.183.151
-- Database Name: tanaka_vms
-- =============================================================================

-- Step 1: Create Database (Run this in default 'postgres' DB if database does not exist)
-- CREATE DATABASE tanaka_vms;
-- \c tanaka_vms;

-- Enable UUID extension for auto-generating unique keys if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if re-initializing (Order respects foreign key dependencies)
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS login_history CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS blacklist CASCADE;
DROP TABLE IF EXISTS contractors CASCADE;
DROP TABLE IF EXISTS visitors CASCADE;
DROP TABLE IF EXISTS meeting_venues CASCADE;
DROP TABLE IF EXISTS contractor_categories CASCADE;
DROP TABLE IF EXISTS visitor_categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS password_policy CASCADE;

-- =============================================================================
-- 1. DEPARTMENTS
-- =============================================================================
CREATE TABLE departments (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    head_of_department VARCHAR(100),
    floor_level VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. COMPANIES
-- =============================================================================
CREATE TABLE companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    registration_number VARCHAR(100),
    company_type VARCHAR(50) NOT NULL CHECK (company_type IN ('INTERNAL', 'CONTRACTOR_VENDOR', 'VISITOR_ORGANIZATION')),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(100),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    department_id VARCHAR(50) REFERENCES departments(id) ON DELETE SET NULL,
    department_name VARCHAR(150),
    registered_by_user_id VARCHAR(50),
    registered_by_user_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 3. USERS
-- =============================================================================
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('ADMINISTRATOR', 'STAFF', 'SECURITY', 'MANAGING_DIRECTOR')),
    department_id VARCHAR(50) REFERENCES departments(id) ON DELETE SET NULL,
    department_name VARCHAR(150),
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    badge_id VARCHAR(50),
    phone VARCHAR(50),
    password VARCHAR(255),
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 4. VISITOR CATEGORIES
-- =============================================================================
CREATE TABLE visitor_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    requires_escort BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- 5. CONTRACTOR CATEGORIES
-- =============================================================================
CREATE TABLE contractor_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    safety_induction_required BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- 6. MEETING VENUES
-- =============================================================================
CREATE TABLE meeting_venues (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    building_block VARCHAR(100) NOT NULL,
    building_blocks TEXT[],
    floor_level VARCHAR(50) NOT NULL,
    floor_levels TEXT[],
    capacity INT DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- 7. VISITORS
-- =============================================================================
CREATE TABLE visitors (
    id VARCHAR(50) PRIMARY KEY,
    registration_no VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    id_number VARCHAR(50) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(100),
    company_name VARCHAR(150),
    visitor_category_id VARCHAR(50) REFERENCES visitor_categories(id) ON DELETE SET NULL,
    visitor_category_name VARCHAR(100),
    purpose TEXT,
    host_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    host_user_name VARCHAR(100),
    host_department VARCHAR(150),
    meeting_venue_id VARCHAR(50) REFERENCES meeting_venues(id) ON DELETE SET NULL,
    meeting_venue_name VARCHAR(150),
    scheduled_date DATE NOT NULL,
    scheduled_end_date DATE,
    scheduled_start_time VARCHAR(10) DEFAULT '09:00',
    scheduled_end_time VARCHAR(10) DEFAULT '17:00',
    status VARCHAR(30) DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'SCHEDULED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'REJECTED')),
    approval_status VARCHAR(20) DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_conditional_approval BOOLEAN DEFAULT FALSE,
    approval_remark TEXT,
    approved_venue_id VARCHAR(50) REFERENCES meeting_venues(id) ON DELETE SET NULL,
    approved_venue_name VARCHAR(150),
    approved_by_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_name VARCHAR(100),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    pass_badge_number VARCHAR(50),
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    check_in_security_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    check_in_security_user_name VARCHAR(100),
    check_out_security_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    check_out_security_user_name VARCHAR(100),
    vehicle_number VARCHAR(50),
    items_carried TEXT,
    is_blacklisted_at_registration BOOLEAN DEFAULT FALSE,
    notes TEXT,
    exceeded_minutes INT DEFAULT 0,
    overstay_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 8. CONTRACTORS
-- =============================================================================
CREATE TABLE contractors (
    id VARCHAR(50) PRIMARY KEY,
    registration_no VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    id_number VARCHAR(50) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(100),
    company_name VARCHAR(150),
    work_order_no VARCHAR(50),
    contractor_category_id VARCHAR(50) REFERENCES contractor_categories(id) ON DELETE SET NULL,
    contractor_category_name VARCHAR(100),
    work_scope TEXT,
    host_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    host_user_name VARCHAR(100),
    host_department VARCHAR(150),
    location_venue_id VARCHAR(50) REFERENCES meeting_venues(id) ON DELETE SET NULL,
    location_venue_name VARCHAR(150),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time VARCHAR(10) DEFAULT '08:00',
    end_time VARCHAR(10) DEFAULT '17:00',
    status VARCHAR(30) DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'SCHEDULED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'REJECTED')),
    approval_status VARCHAR(20) DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_conditional_approval BOOLEAN DEFAULT FALSE,
    approval_remark TEXT,
    approved_venue_id VARCHAR(50) REFERENCES meeting_venues(id) ON DELETE SET NULL,
    approved_venue_name VARCHAR(150),
    approved_by_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_name VARCHAR(100),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    safety_induction_verified BOOLEAN DEFAULT FALSE,
    pass_badge_number VARCHAR(50),
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    check_in_security_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    check_in_security_user_name VARCHAR(100),
    check_out_security_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    check_out_security_user_name VARCHAR(100),
    vehicle_number VARCHAR(50),
    tools_equipment_carried TEXT,
    is_foreign_worker BOOLEAN DEFAULT FALSE,
    passport_number VARCHAR(50),
    nationality VARCHAR(50),
    permit_number VARCHAR(50),
    permit_expiry_date DATE,
    permit_status VARCHAR(30) DEFAULT 'NOT_APPLICABLE' CHECK (permit_status IN ('VALID', 'EXPIRED', 'NOT_APPLICABLE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 9. BLACKLIST / WATCHLIST
-- =============================================================================
CREATE TABLE IF NOT EXISTS blacklist_entries (
    id VARCHAR(255) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    id_number VARCHAR(255) NOT NULL,
    phone VARCHAR(255),
    email VARCHAR(255),
    type VARCHAR(50) DEFAULT 'BLACKLIST',
    reason TEXT NOT NULL,
    severity VARCHAR(50) DEFAULT 'HIGH',
    blocked_by_user_id VARCHAR(255),
    blocked_by_user_name VARCHAR(255),
    date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Backwards-compatible view for 'blacklist' name
CREATE OR REPLACE VIEW blacklist AS 
SELECT id, full_name, id_number, reason, severity, blocked_by_user_id, blocked_by_user_name, date_added, is_active, date_added as created_at 
FROM blacklist_entries;

-- =============================================================================
-- 10. AUDIT LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255),
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(100),
    computer_name VARCHAR(255),
    category VARCHAR(50) DEFAULT 'System'
);

-- =============================================================================
-- 11. LOGIN HISTORY
-- =============================================================================
CREATE TABLE IF NOT EXISTS login_history (
    id VARCHAR(255) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255),
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    ip_address VARCHAR(100),
    status VARCHAR(50) DEFAULT 'SUCCESS',
    user_agent TEXT
);

-- =============================================================================
-- 12. SYSTEM SETTINGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    company_name VARCHAR(255) NOT NULL DEFAULT 'Enterprise Headquarters Corp',
    pass_prefix_visitor VARCHAR(50) NOT NULL DEFAULT 'V-BADGE-',
    pass_prefix_contractor VARCHAR(50) NOT NULL DEFAULT 'C-BADGE-',
    max_daily_visitors INTEGER NOT NULL DEFAULT 150,
    auto_check_out_grace_hours INTEGER NOT NULL DEFAULT 12,
    require_id_verification BOOLEAN NOT NULL DEFAULT TRUE,
    require_vehicle_record BOOLEAN NOT NULL DEFAULT TRUE,
    allow_self_checkout BOOLEAN NOT NULL DEFAULT FALSE,
    on_premise_notice_text TEXT NOT NULL DEFAULT 'All visitors must display their physical badge visibly at all times while on company premises. Photography prohibited without written clearance.',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 13. EMAIL SETTINGS & ROUTING
-- =============================================================================
CREATE TABLE IF NOT EXISTS email_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    smtp_server VARCHAR(255) NOT NULL DEFAULT '157.9.183.242',
    smtp_port INTEGER NOT NULL DEFAULT 25,
    from_address VARCHAR(255) NOT NULL DEFAULT 'Administrator@tanaka.com.my',
    from_name VARCHAR(255) NOT NULL DEFAULT 'Tanaka Visitor Management System',
    md_email VARCHAR(255) NOT NULL DEFAULT 'luqman@tanaka.com.my',
    it_email VARCHAR(255) DEFAULT 'IT@tanaka.com.my',
    production_manager_email VARCHAR(255) DEFAULT 'nakamu@ml.tanaka.co.jp, luqman@tanaka.com.my',
    fallback_admin_email VARCHAR(255) DEFAULT 'luqman@tanaka.com.my',
    secure BOOLEAN DEFAULT FALSE,
    enable_md_notifications BOOLEAN DEFAULT TRUE,
    enable_prod_manager_notifications BOOLEAN DEFAULT TRUE,
    enable_new_user_notifications BOOLEAN DEFAULT TRUE,
    enable_check_in_notifications BOOLEAN DEFAULT TRUE,
    backup_approver_email VARCHAR(255),
    backup_approver_name VARCHAR(255),
    backup_approver_user_id VARCHAR(255),
    enable_delegation BOOLEAN DEFAULT FALSE,
    delegation_start_date VARCHAR(50),
    delegation_end_date VARCHAR(50),
    delegation_routing_mode VARCHAR(50) DEFAULT 'BOTH',
    delegation_reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 14. PASSWORD POLICY
-- =============================================================================
CREATE TABLE IF NOT EXISTS password_policy (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    min_length INTEGER NOT NULL DEFAULT 10,
    require_uppercase BOOLEAN NOT NULL DEFAULT TRUE,
    require_numbers BOOLEAN NOT NULL DEFAULT TRUE,
    require_special_char BOOLEAN NOT NULL DEFAULT TRUE,
    expiration_days INTEGER NOT NULL DEFAULT 90,
    max_failed_attempts INTEGER NOT NULL DEFAULT 5,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 15. EMAIL LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS email_logs (
    id VARCHAR(255) PRIMARY KEY,
    request_id VARCHAR(255),
    email_type VARCHAR(100) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_message TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- =============================================================================
CREATE INDEX idx_visitors_registration_no ON visitors(registration_no);
CREATE INDEX idx_visitors_status ON visitors(status);
CREATE INDEX idx_visitors_scheduled_date ON visitors(scheduled_date);
CREATE INDEX idx_visitors_scheduled_end_date ON visitors(scheduled_end_date);
CREATE INDEX idx_visitors_date_range ON visitors(scheduled_date, scheduled_end_date);
CREATE INDEX idx_visitors_host_user_id ON visitors(host_user_id);

CREATE INDEX idx_contractors_registration_no ON contractors(registration_no);
CREATE INDEX idx_contractors_status ON contractors(status);
CREATE INDEX idx_contractors_start_end_date ON contractors(start_date, end_date);
CREATE INDEX idx_contractors_host_user_id ON contractors(host_user_id);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- =============================================================================
-- SEED INITIAL SYSTEM DATA
-- =============================================================================

-- 1. Departments
INSERT INTO departments (id, code, name, head_of_department, floor_level, is_active) VALUES
('dept-exec', 'EXEC', 'Executive Directorate', 'Tanaka Kenji', 'Level 5', true),
('dept-it', 'IT', 'Information Technology', 'Robert Zhao', 'Level 4', true),
('dept-hr', 'HR', 'Human Resources', 'Amanda Smith', 'Level 2', true),
('dept-fin', 'FIN', 'Finance & Accounting', 'David Chen', 'Level 3', true),
('dept-fac', 'FAC', 'Facility Management & Security', 'Officer Alex Rivera', 'Ground Floor Guard Desk', true),
('dept-leg', 'LEG', 'Legal & Compliance', 'Patricia Vance', 'Level 5', true),
('dept-prod', 'PROD', 'Production', 'Luqman', 'Prod 1 / Prod 2', true);

-- 2. Companies
INSERT INTO companies (id, name, registration_number, company_type, contact_phone, contact_email, address, is_active, department_id, department_name, registered_by_user_name, created_at) VALUES
('comp-internal', 'Enterprise Headquarters Corp', 'HQ-883921', 'INTERNAL', '+1 555-0100', 'info@enterprise.internal', '100 Enterprise Way, Tower A', true, 'dept-it', 'Information Technology', 'System Admin', '2026-01-10'),
('comp-ext-1', 'CyberShield Systems Inc.', 'CS-90211', 'CONTRACTOR_VENDOR', '+1 555-0219', 'contact@cybershield.com', '45 Tech Plaza, Suite 300', true, 'dept-it', 'Information Technology', 'John Miller', '2026-02-14'),
('comp-ext-2', 'Acme Global Consulting', 'ACME-4402', 'VISITOR_ORGANIZATION', '+1 555-0312', 'support@acmeglobal.com', '12 Financial Center', true, 'dept-it', 'Information Technology', 'John Miller', '2026-03-01'),
('comp-ext-3', 'CleanPro Facility Solutions', 'CP-11094', 'CONTRACTOR_VENDOR', '+1 555-0488', 'dispatch@cleanpro.com', '88 Industrial Parkway', true, 'dept-fac', 'Facility Management & Security', 'Officer Alex Rivera', '2026-03-15'),
('comp-apx', 'Apex Global Solutions', 'COMP-APX-880', 'VISITOR_ORGANIZATION', '+60 3-8890 1100', 'contact@apexglobal.com', 'Level 18, Apex Tech Tower, Cyberjaya', true, 'dept-it', 'Information Technology', 'John Miller', '2026-04-02'),
('comp-cyb', 'Cyberdyne Security Ltd', 'COMP-CYB-991', 'VISITOR_ORGANIZATION', '+60 3-7720 4400', 'info@cyberdyne.io', 'Block C, Cyberdyne Park, Bangsar South', true, 'dept-hr', 'Human Resources', 'Sarah Jenkins', '2026-04-10'),
('comp-nxg', 'NexGen Logistics Corp', 'COMP-NXG-502', 'VISITOR_ORGANIZATION', '+60 3-5510 9900', 'ops@nexgenlogistics.com', 'Lot 45, Logistics Hub, Port Klang', true, 'dept-fin', 'Finance & Procurement', 'Finance Dept', '2026-05-01'),
('comp-cooltech', 'CoolTech HVAC Engineering', 'COMP-CT-9910', 'CONTRACTOR_VENDOR', '+60 3-8812 9900', 'info@cooltech-hvac.com', 'No. 12 Jalan Industri 4, Puchong', true, 'dept-it', 'Information Technology', 'John Miller', '2026-06-12');

-- 3. Users
INSERT INTO users (id, username, full_name, email, role, department_id, department_name, company_id, is_active, last_login_at, badge_id, phone) VALUES
('usr-admin-1', 'admin', 'Evelyn Reed', 'evelyn.reed@enterprise.internal', 'ADMINISTRATOR', 'dept-it', 'Information Technology', 'comp-internal', true, CURRENT_TIMESTAMP, 'ADM-001', '+1 (555) 019-2831'),
('usr-md-1', 'managing_director', 'Tanaka Kenji (Managing Director)', 'tanaka.kenji@enterprise.internal', 'MANAGING_DIRECTOR', 'dept-exec', 'Executive Directorate', 'comp-internal', true, CURRENT_TIMESTAMP, 'MD-001', '+1 (555) 011-9900'),
('usr-staff-1', 'staff_john', 'John Miller', 'john.miller@enterprise.internal', 'STAFF', 'dept-it', 'Information Technology', 'comp-internal', true, CURRENT_TIMESTAMP, 'STF-104', '+1 (555) 014-9921'),
('usr-staff-2', 'staff_sarah', 'Sarah Jenkins', 'sarah.jenkins@enterprise.internal', 'STAFF', 'dept-hr', 'Human Resources', 'comp-internal', true, CURRENT_TIMESTAMP, 'STF-208', '+1 (555) 018-3342'),
('usr-sec-1', 'sec_officer1', 'Officer Alex Rivera', 'alex.rivera@enterprise.internal', 'SECURITY', 'dept-fac', 'Facility Management & Security', 'comp-internal', true, CURRENT_TIMESTAMP, 'SEC-801', '+1 (555) 012-7711'),
('usr-sec-2', 'sec_officer2', 'Officer Marcus Vance', 'marcus.vance@enterprise.internal', 'SECURITY', 'dept-fac', 'Facility Management & Security', 'comp-internal', true, CURRENT_TIMESTAMP, 'SEC-802', '+1 (555) 012-7712'),
('usr-prod-1', 'luqman', 'Luqman (Production Manager)', 'IT@tanaka.com.my', 'STAFF', 'dept-prod', 'Production', 'comp-internal', true, CURRENT_TIMESTAMP, 'PM-001', '+60 12-345 6789');

-- 4. Visitor Categories
INSERT INTO visitor_categories (id, name, description, requires_escort, is_active) VALUES
('vc-1', 'Customer', 'Clients, corporate guests, and customer business meetings', false, true),
('vc-2', 'Supplier', 'Raw material and goods suppliers', false, true),
('vc-3', 'Vendor', 'Commercial vendors and solution providers', false, true),
('vc-4', 'Interview', 'Job applicants attending talent acquisition interviews', false, true),
('vc-5', 'Government', 'State, municipal, and government regulatory officials', true, true),
('vc-6', 'VIP', 'High-profile executives, dignitaries & board members', true, true),
('vc-7', 'Delivery', 'Courier, parcel delivery & freight handlers', false, true),
('vc-8', 'Maintenance', 'Facility, HVAC & office maintenance reps', false, true),
('vc-9', 'Training', 'External trainees and workshop participants', false, true),
('vc-10', 'Audit', 'Internal & external compliance auditors', true, true);

-- 5. Contractor Categories
INSERT INTO contractor_categories (id, name, safety_induction_required, is_active) VALUES
('cc-1', 'Electrical', true, true),
('cc-2', 'Mechanical', true, true),
('cc-3', 'Cleaning', false, true),
('cc-4', 'IT Vendor', true, true),
('cc-5', 'Construction', true, true),
('cc-6', 'Maintenance', true, true),
('cc-7', 'Calibration', true, true),
('cc-8', 'Renovation', true, true),
('cc-9', 'IT Work', true, true);

-- 6. Meeting Venues
INSERT INTO meeting_venues (id, name, building_block, building_blocks, floor_level, floor_levels, capacity, is_active) VALUES
('mv-1', 'Executive Boardroom 1', 'Tower A', ARRAY['Tower A'], 'Level 5', ARRAY['Level 5'], 20, true),
('mv-2', 'Internal common area & Prod 1 corridor', 'Prod 1', ARRAY['Prod 1'], 'Corridor', ARRAY['Corridor', 'Common Area'], 15, true),
('mv-3', 'Internal common area & Prod 2 corridor', 'Prod 2', ARRAY['Prod 2'], 'Corridor', ARRAY['Corridor', 'Common Area'], 15, true),
('mv-4', 'Internal common area & Prod 1 inside', 'Prod 1', ARRAY['Prod 1'], 'Inside', ARRAY['Inside', 'Prod Floor'], 12, true),
('mv-5', 'Internal common area & Prod 2 inside', 'Prod 2', ARRAY['Prod 2'], 'Inside', ARRAY['Inside', 'Prod Floor'], 12, true),
('mv-6', 'internal common area & Prod 1 & 2 inside', 'Prod 1, Prod 2', ARRAY['Prod 1', 'Prod 2'], 'Inside', ARRAY['Inside', 'Common Area'], 25, true),
('mv-7', 'Inside common area & Prod 1 & 2 corridor', 'Prod 1, Prod 2', ARRAY['Prod 1', 'Prod 2'], 'Corridor', ARRAY['Corridor', 'Inside'], 20, true),
('mv-8', 'MD Room', 'Executive Block', ARRAY['Executive Block'], 'Level 3', ARRAY['Level 3'], 8, true),
('mv-9', 'Common Area', 'Main Building', ARRAY['Main Building'], 'Ground Floor', ARRAY['Ground Floor', 'Lobby'], 50, true);

-- 7. System Settings
INSERT INTO system_settings (id, company_name, pass_prefix_visitor, pass_prefix_contractor, max_daily_visitors, auto_check_out_grace_hours, require_id_verification, require_vehicle_record, allow_self_checkout, on_premise_notice_text) VALUES
('default', 'Enterprise Headquarters Corp', 'V-BADGE-', 'C-BADGE-', 150, 12, true, true, false, 'All visitors must display their physical badge visibly at all times while on company premises. Photography prohibited without written clearance.')
ON CONFLICT (id) DO NOTHING;

-- 8. Email Settings & Routing
INSERT INTO email_settings (id, smtp_server, smtp_port, from_address, from_name, md_email, it_email, production_manager_email, fallback_admin_email, secure, enable_md_notifications, enable_prod_manager_notifications, enable_new_user_notifications, enable_check_in_notifications) VALUES
('default', '157.9.183.242', 25, 'Administrator@tanaka.com.my', 'Tanaka Visitor Management System', 'luqman@tanaka.com.my', 'IT@tanaka.com.my', 'nakamu@ml.tanaka.co.jp, luqman@tanaka.com.my', 'luqman@tanaka.com.my', false, true, true, true, true)
ON CONFLICT (id) DO NOTHING;

-- 9. Password Policy
INSERT INTO password_policy (id, min_length, require_uppercase, require_numbers, require_special_char, expiration_days, max_failed_attempts) VALUES
('default', 10, true, true, true, 90, 5)
ON CONFLICT (id) DO NOTHING;

-- Final Confirmation Output
SELECT 'Enterprise VMS PostgreSQL Database Schema and Initial Seed Data loaded successfully!' AS status;
