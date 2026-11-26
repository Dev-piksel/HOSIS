-- ====================================================================
-- HOSIS - Finance & Accounting Subsystem Integration Migration
-- Migration 42: Finance roles, sequences, damage tracking, promotions, and sales enhancements
-- 100% Idempotent
-- ====================================================================

-- 1. Expanded user roles for Finance and departmental workflows
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
    role IN (
        'ADMIN',
        'SUPER_ADMIN',
        'FRONT_OFFICE',
        'HOUSEKEEPING',
        'HR',
        'FINANCE',
        'FINANCE_ADMIN',
        'FINANCE_STAFF',
        'FINANCE_OFFICER',
        'OFFICER',
        'DEPARTMENT_HEAD',
        'HEAD',
        'FINANCE_HEAD',
        'FOOD_BEVERAGE',
        'SALES_MARKETING',
        'ENGINEERING',
        'TECHNICIAN'
    )
);

-- 2. Concurrency-safe sequences for financial numbering
CREATE SEQUENCE IF NOT EXISTS seq_finance_invoice_num START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS seq_finance_payment_num START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS seq_finance_expense_num START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS seq_finance_payroll_num START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS seq_finance_hk_damage_num START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS seq_finance_sales_record_num START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS seq_finance_txn_num START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS seq_finance_leave_num START WITH 1000;

-- 3. Ensure columns exist on finance_invoices
ALTER TABLE finance_invoices ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(30) NOT NULL DEFAULT 'GUEST';
ALTER TABLE finance_invoices ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE finance_invoices ADD COLUMN IF NOT EXISTS department VARCHAR(80);
ALTER TABLE finance_invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4. Ensure columns exist on finance_invoice_items
ALTER TABLE finance_invoice_items ADD COLUMN IF NOT EXISTS category VARCHAR(80) DEFAULT 'GENERAL';
ALTER TABLE finance_invoice_items ADD COLUMN IF NOT EXISTS source VARCHAR(80) DEFAULT 'FINANCE';

-- 5. Ensure columns exist on finance_sales_records
ALTER TABLE finance_sales_records ADD COLUMN IF NOT EXISTS milestone_stage VARCHAR(50) DEFAULT 'DEPOSIT_20';
ALTER TABLE finance_sales_records ADD COLUMN IF NOT EXISTS parent_deal_code VARCHAR(50);
ALTER TABLE finance_sales_records ADD COLUMN IF NOT EXISTS payment_term_days INTEGER DEFAULT 30;

-- 6. Housekeeping damage findings fallback integration table
CREATE TABLE IF NOT EXISTS finance_hk_damages (
    id BIGSERIAL PRIMARY KEY,
    incident_code VARCHAR(50) NOT NULL UNIQUE,
    room_number VARCHAR(40) NOT NULL,
    guest_name VARCHAR(200) NOT NULL,
    reservation_code VARCHAR(50),
    damaged_item VARCHAR(200) NOT NULL,
    damage_category VARCHAR(80) NOT NULL DEFAULT 'FIXTURE' CHECK (
        damage_category IN (
            'FIXTURE', 'FURNITURE', 'LINEN', 'APPLIANCE', 'AMENITY', 'BATHROOM', 'WALL_FLOOR', 'OTHER'
        )
    ),
    description TEXT,
    estimated_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (estimated_cost >= 0),
    billed_cost NUMERIC(12, 2) DEFAULT 0.00 CHECK (billed_cost >= 0),
    billing_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_BILLING' CHECK (
        billing_status IN ('PENDING_BILLING', 'BILLED_TO_FOLIO', 'WAIVED', 'DISPUTED')
    ),
    invoice_id BIGINT REFERENCES finance_invoices(id) ON DELETE SET NULL,
    reported_by VARCHAR(100) DEFAULT 'Housekeeping Department',
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    billed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_hk_damages_status ON finance_hk_damages (billing_status);
CREATE INDEX IF NOT EXISTS idx_fin_hk_damages_room ON finance_hk_damages (room_number);

-- 7. Promotions table for Front Office & Sales integration
CREATE TABLE IF NOT EXISTS promotions (
    id BIGSERIAL PRIMARY KEY,
    promo_code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE' CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
    min_spend NUMERIC(10, 2) DEFAULT 0.00,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL DEFAULT CURRENT_DATE + INTERVAL '90 days',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    target_room_type VARCHAR(50) DEFAULT 'ALL',
    created_by VARCHAR(100) DEFAULT 'Sales & Marketing Team',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions (promo_code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions (is_active);

-- Seed initial promotions if empty
INSERT INTO promotions (promo_code, title, description, discount_type, discount_value, min_spend, target_room_type, created_by)
VALUES
    ('SUMMER2026', 'Summer Horizon Getaway', '15% discount on all room reservations and luxury suites.', 'PERCENTAGE', 15.00, 100.00, 'ALL', 'Sales & Marketing'),
    ('CORP_SPECIAL', 'Corporate Partner Privilege', '20% discount for registered corporate business accounts and conference delegates.', 'PERCENTAGE', 20.00, 150.00, 'ALL', 'Sales & Marketing'),
    ('WEEKEND_GETAWAY', 'Weekend Relaxer Credit', 'Fixed $50 / ₱2,500 credit on multi-night weekend bookings.', 'FIXED', 50.00, 200.00, 'ALL', 'Sales & Marketing'),
    ('VIP_DELUXE', 'Executive Suite VIP Privilege', '25% premium discount on Executive and Presidential Suites.', 'PERCENTAGE', 25.00, 300.00, 'Suite', 'Sales & Marketing'),
    ('EARLYBIRD', 'Advance Booking Special', '10% discount on bookings confirmed at least 14 days in advance.', 'PERCENTAGE', 10.00, 80.00, 'ALL', 'Sales & Marketing')
ON CONFLICT (promo_code) DO NOTHING;

-- 8. Seed default damage incidents if empty
INSERT INTO finance_hk_damages (incident_code, room_number, guest_name, reservation_code, damaged_item, damage_category, description, estimated_cost, billing_status, reported_by, reported_at)
VALUES
    ('HKD-2610-01', '302', 'David Richardson', 'RES-261011', 'Premium Egyptian Cotton Duvet (Burn Mark)', 'LINEN', 'Burn mark found on duvet after checkout in non-smoking suite.', 4500.00, 'PENDING_BILLING', 'R. Diaz (HK Inspector)', NOW() - INTERVAL '2 days'),
    ('HKD-2610-02', '415', 'Elena Rostova', 'RES-261014', 'Bathroom Marble Mirror (Cracked Frame)', 'FIXTURE', 'Heavy cosmetic crack on vanity mirror bezel.', 6800.00, 'PENDING_BILLING', 'M. Santos (HK Supervisor)', NOW() - INTERVAL '1 day'),
    ('HKD-2610-03', '208', 'James Wilson', 'RES-261018', 'Minibar Wine Glasses (2x Shattered)', 'AMENITY', 'Two crystal wine glasses broken during stay.', 1200.00, 'PENDING_BILLING', 'A. Lim (HK Room Attendant)', NOW() - INTERVAL '6 hours')
ON CONFLICT (incident_code) DO NOTHING;

-- 9. Runtime permissions
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='hosis_runtime') THEN
        GRANT SELECT, INSERT, UPDATE ON finance_hk_damages, promotions, finance_sales_records, finance_statutory_rates TO hosis_runtime;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hosis_runtime;
    END IF;
END $$;
