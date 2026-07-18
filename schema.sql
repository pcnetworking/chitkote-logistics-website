-- ============================================================================
-- CHITKOTE LOGISTICS INDIA PVT. LTD.
-- Database Schema for Truck Owner Onboarding Module
-- Supported SQL Engines: PostgreSQL 12+ / MySQL 8.0+
-- ============================================================================

-- 1. TRUCK OWNERS TABLE
CREATE TABLE IF NOT EXISTS truck_owners (
    id SERIAL PRIMARY KEY,
    owner_code VARCHAR(20) NOT NULL UNIQUE, -- e.g. CKL-TRO-000001
    full_name VARCHAR(150) NOT NULL,
    mobile_number VARCHAR(15) NOT NULL UNIQUE,
    alt_mobile_number VARCHAR(15),
    email_address VARCHAR(150) NOT NULL,
    pan_number VARCHAR(10) NOT NULL UNIQUE,
    aadhaar_number VARCHAR(12),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- Individual, Proprietor, Partnership, Pvt Ltd
    company_name VARCHAR(150) NOT NULL,
    gst_number VARCHAR(15),
    business_address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by owner_code, mobile, PAN, and company name
CREATE INDEX IF NOT EXISTS idx_truck_owners_mobile ON truck_owners(mobile_number);
CREATE INDEX IF NOT EXISTS idx_truck_owners_pan ON truck_owners(pan_number);
CREATE INDEX IF NOT EXISTS idx_truck_owners_code ON truck_owners(owner_code);

-- 2. VEHICLES TABLE
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    vehicle_code VARCHAR(20) NOT NULL UNIQUE, -- e.g. CKL-VEH-000001
    truck_owner_id INT NOT NULL REFERENCES truck_owners(id) ON DELETE CASCADE,
    vehicle_number VARCHAR(20) NOT NULL UNIQUE, -- e.g. TS08EX1234
    vehicle_type VARCHAR(50) NOT NULL, -- 14 FT, 17 FT, 20 FT, 22 FT, 32 FT, Trailer, Open Body, Container, Other
    capacity_tons DECIMAL(5, 2) NOT NULL,
    registration_state VARCHAR(100) NOT NULL,
    model_year INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for searching vehicles by vehicle number and truck owner ID
CREATE INDEX IF NOT EXISTS idx_vehicles_number ON vehicles(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id ON vehicles(truck_owner_id);

-- 3. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    truck_owner_id INT NOT NULL REFERENCES truck_owners(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- rc_book, pan_card, vehicle_insurance, owner_photo, aadhaar_card, gst_certificate, driving_license, bank_passbook
    is_mandatory BOOLEAN DEFAULT FALSE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    verification_status VARCHAR(30) DEFAULT 'Pending', -- Pending, Verified, Rejected
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(truck_owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);

-- 4. BANK DETAILS TABLE
CREATE TABLE IF NOT EXISTS bank_details (
    id SERIAL PRIMARY KEY,
    truck_owner_id INT NOT NULL UNIQUE REFERENCES truck_owners(id) ON DELETE CASCADE,
    account_holder_name VARCHAR(150) NOT NULL,
    bank_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(15) NOT NULL,
    upi_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. ONBOARDING STATUS TABLE
CREATE TABLE IF NOT EXISTS onboarding_status (
    id SERIAL PRIMARY KEY,
    truck_owner_id INT NOT NULL UNIQUE REFERENCES truck_owners(id) ON DELETE CASCADE,
    current_status VARCHAR(50) NOT NULL DEFAULT 'Submitted', -- Submitted, Under Review, Documents Pending, Approved, Rejected
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_onboarding_status_current ON onboarding_status(current_status);

-- 6. ADMIN REMARKS TABLE
CREATE TABLE IF NOT EXISTS admin_remarks (
    id SERIAL PRIMARY KEY,
    truck_owner_id INT NOT NULL REFERENCES truck_owners(id) ON DELETE CASCADE,
    admin_username VARCHAR(100) NOT NULL DEFAULT 'System Admin',
    remark_text TEXT NOT NULL,
    status_transition VARCHAR(50), -- Status change associated with remark
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_remarks_owner_id ON admin_remarks(truck_owner_id);
