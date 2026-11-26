const fs = require('node:fs/promises')
const path = require('node:path')
const bcrypt = require('bcrypt')

async function main() {
  const schemaDir = path.resolve(__dirname, '../../database/schema')
  const outputFile = path.resolve(__dirname, '../../database/init_complete_schema.sql')

  const files = (await fs.readdir(schemaDir))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  let sql = `-- ====================================================================
-- GRAND HORIZON HOTEL & RESORT
-- HOSIS (Hotel Operations & Services Integrated System)
-- Complete Consolidated Database Setup for New Hosting
-- Compatible with: Supabase, Neon, Render, Railway, AWS RDS, Local PostgreSQL
-- ====================================================================

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

-- Clean reset of application schemas (ensures error-free execution if previous runs failed midway)
DROP SCHEMA IF EXISTS engineering CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;

-- Ensure required schemas exist
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS engineering;

-- Ensure standard public permissions
GRANT ALL ON SCHEMA public TO PUBLIC;
GRANT ALL ON SCHEMA engineering TO PUBLIC;

-- Schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

`

  for (const f of files) {
    const content = (await fs.readFile(path.join(schemaDir, f), 'utf8')).trim()
    if (!content) continue
    sql += `-- ====================================================================\n`
    sql += `-- Migration: ${f}\n`
    sql += `-- ====================================================================\n`
    sql += content + `\n\n`
    sql += `INSERT INTO schema_migrations (filename) VALUES ('${f}') ON CONFLICT (filename) DO NOTHING;\n\n`
  }

  // Pre-generate correct bcrypt hashes for default accounts
  const defaultAccounts = [
    { username: 'admin', pass: 'Admin123456!', role: 'ADMIN', pos: 'SUPERVISOR', fn: 'System', ln: 'Administrator' },
    { username: 'superadmin', pass: 'Admin123456!', role: 'SUPER_ADMIN', pos: 'SUPERVISOR', fn: 'Super', ln: 'Admin' },
    { username: 'frontoffice', pass: 'FrontOffice123456!', role: 'FRONT_OFFICE', pos: 'SUPERVISOR', fn: 'Front', ln: 'Office' },
    { username: 'frontdesk', pass: 'FrontOffice123456!', role: 'FRONT_OFFICE', pos: 'SUPERVISOR', fn: 'Front', ln: 'Desk' },
    { username: 'finance.officer', pass: 'Finance123456!', role: 'FINANCE', pos: 'SUPERVISOR', fn: 'Elena', ln: 'Ramos' },
    { username: 'finofficer', pass: 'FinanceOfficer2026!', role: 'FINANCE', pos: 'SUPERVISOR', fn: 'Elena', ln: 'Ramos' },
    { username: 'officer', pass: 'Finance123456!', role: 'OFFICER', pos: 'SUPERVISOR', fn: 'Finance', ln: 'Officer' },
    { username: 'finance.head', pass: 'Head123456!', role: 'DEPARTMENT_HEAD', pos: 'SUPERVISOR', fn: 'Danielle', ln: 'Villanueva' },
    { username: 'finhead', pass: 'FinanceHead2026!', role: 'DEPARTMENT_HEAD', pos: 'SUPERVISOR', fn: 'Danielle', ln: 'Villanueva' },
    { username: 'head', pass: 'Head123456!', role: 'HEAD', pos: 'SUPERVISOR', fn: 'Department', ln: 'Head' },
    { username: 'financehead', pass: 'Head123456!', role: 'DEPARTMENT_HEAD', pos: 'SUPERVISOR', fn: 'Finance', ln: 'Head' },
    { username: 'sales.agent', pass: 'Sales123456!', role: 'SALES_MARKETING', pos: 'SALES_STAFF', fn: 'Camille', ln: 'Ocampo' },
    { username: 'sales.manager', pass: 'Sales123456!', role: 'SALES_MARKETING', pos: 'SALES_HEAD', fn: 'Marco', ln: 'Cruz' },
    { username: 'hr', pass: 'Hr123456!', role: 'HR', pos: 'SUPERVISOR', fn: 'Human', ln: 'Resources' },
    { username: 'engineer', pass: 'Engineer123456!', role: 'ENGINEERING', pos: 'SUPERVISOR', fn: 'Chief', ln: 'Engineer' },
    { username: 'technician', pass: 'Technician123456!', role: 'TECHNICIAN', pos: 'TECHNICIAN', fn: 'Lead', ln: 'Technician' },
    { username: 'housekeeper', pass: 'Housekeeper123456!', role: 'HOUSEKEEPING', pos: 'HOUSEKEEPER', fn: 'Maria', ln: 'Santos' },
    { username: 'inspector', pass: 'Inspector123456!', role: 'HOUSEKEEPING', pos: 'INSPECTOR', fn: 'Roberto', ln: 'Diaz' },
  ]

  sql += `-- ====================================================================
-- BASELINE SEED DATA FOR NEW HOSTING ENVIRONMENT
-- ====================================================================

-- 1. Default Hotel Staff Accounts
`

  for (const a of defaultAccounts) {
    const hash = await bcrypt.hash(a.pass, 10)
    sql += `INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('${a.username}', '${hash}', '${a.role}', '${a.pos}', '${a.fn}', '${a.ln}', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;\n`
  }

  sql += `
-- 2. Initial Room Inventory
INSERT INTO rooms (room_number, room_type, floor, status) VALUES
('101', 'Standard', '1', 'AVAILABLE'),
('102', 'Standard', '1', 'DIRTY'),
('103', 'Deluxe', '1', 'OCCUPIED'),
('104', 'Suite', '1', 'AVAILABLE'),
('201', 'Standard', '2', 'AVAILABLE'),
('202', 'Standard', '2', 'AVAILABLE'),
('203', 'Deluxe', '2', 'AVAILABLE'),
('204', 'Suite', '2', 'AVAILABLE'),
('301', 'Deluxe', '3', 'AVAILABLE'),
('302', 'Suite', '3', 'AVAILABLE')
ON CONFLICT (room_number) DO NOTHING;

-- 3. Initial Hotel Settings
UPDATE hotel_settings SET
    hotel_name = 'Grand Horizon Hotel & Resort',
    support_email = 'operations@grandhorizon.ph',
    support_phone = '+63 2 8123 4567',
    time_zone = 'Asia/Manila',
    updated_at = NOW()
WHERE id = 1;

-- 4. Initial Housekeeping Inventory
INSERT INTO hk_inventory_items (item_name, category, unit, quantity, reorder_level) VALUES
('Bath Towel Premium', 'LINEN', 'pieces', 120, 30),
('Hand Towel White', 'LINEN', 'pieces', 180, 40),
('Bed Sheet Queen', 'LINEN', 'pieces', 90, 25),
('Organic Soap Bar 50g', 'AMENITY', 'pieces', 400, 100),
('Conditioning Shampoo 40ml', 'AMENITY', 'bottles', 350, 100),
('Dental Kit Eco-Bamboo', 'AMENITY', 'kits', 300, 80),
('Disinfectant Surface Spray', 'CLEANING_SUPPLY', 'gallons', 25, 8)
ON CONFLICT (item_name) DO NOTHING;

-- 5. Supabase Role Permissions (applied dynamically when hosted on Supabase)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
        GRANT ALL ON SCHEMA engineering TO postgres, anon, authenticated, service_role;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
        GRANT ALL ON ALL TABLES IN SCHEMA engineering TO postgres, anon, authenticated, service_role;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA engineering TO postgres, anon, authenticated, service_role;
        GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;
        GRANT ALL ON ALL ROUTINES IN SCHEMA engineering TO postgres, anon, authenticated, service_role;
    END IF;
END $$;
`

  await fs.writeFile(outputFile, sql, 'utf8')
  console.log(`Successfully generated: ${outputFile}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
