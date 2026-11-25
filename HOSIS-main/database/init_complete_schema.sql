-- ====================================================================
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

-- ====================================================================
-- Migration: 01-users.sql
-- ====================================================================
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (
        role IN (
            'ADMIN',
            'FRONT_OFFICE',
            'HOUSEKEEPING',
            'HR',
            'FINANCE',
            'SALES_MARKETING',
            'ENGINEERING'
        )
    ),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    session_version INTEGER NOT NULL DEFAULT 0 CHECK (session_version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES ('01-users.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 10-legacy-housekeeping-canonicalization.sql
-- ====================================================================
-- Data-preserving compatibility for databases first created by the standalone
-- Housekeeping project. The integrated HOSIS application uses canonical
-- `id`, `status`, `floor`, and `phone` column names. Renaming a referenced
-- column keeps existing foreign keys and Housekeeping records intact.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
  ) THEN
    ALTER TABLE users RENAME COLUMN user_id TO id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'room_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'id'
  ) THEN
    ALTER TABLE rooms RENAME COLUMN room_id TO id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'floor_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'floor'
  ) THEN
    ALTER TABLE rooms RENAME COLUMN floor_number TO floor;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'room_status'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'status'
  ) THEN
    ALTER TABLE rooms RENAME COLUMN room_status TO status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'guests' AND column_name = 'guest_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'guests' AND column_name = 'id'
  ) THEN
    ALTER TABLE guests RENAME COLUMN guest_id TO id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'guests' AND column_name = 'contact_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'guests' AND column_name = 'phone'
  ) THEN
    ALTER TABLE guests RENAME COLUMN contact_number TO phone;
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(30) DEFAULT 'HOUSEKEEPER';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'employment_status'
  ) THEN
    EXECUTE 'UPDATE users SET is_active = (employment_status = ''ACTIVE'')';
  END IF;
END $$;

UPDATE users SET position = 'HOUSEKEEPER' WHERE position IS NULL;
ALTER TABLE users ALTER COLUMN position SET DEFAULT 'HOUSEKEEPER';
ALTER TABLE users ALTER COLUMN position SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_session_version_check;
ALTER TABLE users ADD CONSTRAINT users_session_version_check CHECK (session_version >= 0);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users (LOWER(username));

DO $$
BEGIN
  IF TO_REGCLASS('public.rooms') IS NOT NULL THEN
    ALTER TABLE rooms ALTER COLUMN floor TYPE VARCHAR(40) USING floor::text;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF TO_REGCLASS('public.guests') IS NOT NULL THEN
    ALTER TABLE guests ADD COLUMN IF NOT EXISTS email VARCHAR(254);
    ALTER TABLE guests ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
    ALTER TABLE guests ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR(30) NOT NULL DEFAULT 'Member';
    ALTER TABLE guests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE guests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    CREATE UNIQUE INDEX IF NOT EXISTS guests_email_unique_not_null
      ON guests (LOWER(email)) WHERE email IS NOT NULL;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('10-legacy-housekeeping-canonicalization.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 11-front-office.sql
-- ====================================================================
CREATE TABLE IF NOT EXISTS guests (
    id BIGSERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(254),
    phone VARCHAR(40),
    loyalty_tier VARCHAR(30) NOT NULL DEFAULT 'Member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT guests_email_unique UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS rooms (
    id BIGSERIAL PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL UNIQUE,
    room_type VARCHAR(100) NOT NULL,
    floor VARCHAR(40) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' CHECK (
        status IN ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEAN', 'INSPECTED', 'OUT_OF_ORDER')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
    id BIGSERIAL PRIMARY KEY,
    confirmation_code VARCHAR(30) NOT NULL UNIQUE,
    guest_id BIGINT NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
    room_id BIGINT REFERENCES rooms(id) ON DELETE RESTRICT,
    room_type VARCHAR(100) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED' CHECK (
        status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED')
    ),
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT reservations_valid_stay CHECK (check_out > check_in)
);

CREATE INDEX IF NOT EXISTS reservations_room_dates_idx
    ON reservations (room_id, check_in, check_out)
    WHERE status IN ('CONFIRMED', 'CHECKED_IN');
CREATE INDEX IF NOT EXISTS reservations_guest_idx ON reservations (guest_id);

CREATE TABLE IF NOT EXISTS guest_requests (
    id BIGSERIAL PRIMARY KEY,
    guest_id BIGINT REFERENCES guests(id) ON DELETE SET NULL,
    guest_name VARCHAR(201) NOT NULL,
    room_id BIGINT REFERENCES rooms(id) ON DELETE SET NULL,
    request_text TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'STANDARD' CHECK (priority IN ('STANDARD', 'URGENT')),
    status VARCHAR(30) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_PROGRESS', 'COMPLETED')),
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guest_requests_status_created_idx
    ON guest_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(30) NOT NULL UNIQUE,
    guest_id BIGINT NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
    reservation_id BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOID')),
    issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_guest_idx ON invoices (guest_id);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER')),
    reference VARCHAR(120),
    recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_invoice_idx ON payments (invoice_id, paid_at DESC);

CREATE TABLE IF NOT EXISTS front_office_activity (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS front_office_activity_created_idx ON front_office_activity (created_at DESC);

INSERT INTO schema_migrations (filename) VALUES ('11-front-office.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 12-admin.sql
-- ====================================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0
    CHECK (session_version >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
    ON users (LOWER(username));

CREATE TABLE IF NOT EXISTS hotel_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    hotel_name VARCHAR(120) NOT NULL DEFAULT 'Grand Horizon Hotel',
    time_zone VARCHAR(80) NOT NULL DEFAULT 'UTC',
    support_email VARCHAR(254),
    support_phone VARCHAR(40),
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO hotel_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('12-admin.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 13-admin-session-hardening.sql
-- ====================================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0
    CHECK (session_version >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
    ON users (LOWER(username));

INSERT INTO schema_migrations (filename) VALUES ('13-admin-session-hardening.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 14-housekeeping-integration.sql
-- ====================================================================
-- Additive integration: canonical entities remain in the existing tables.
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(254);
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(30) NOT NULL DEFAULT 'HOUSEKEEPER'
 CHECK (position IN ('HOUSEKEEPER', 'INSPECTOR', 'SUPERVISOR'));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (LOWER(email)) WHERE email IS NOT NULL;
CREATE OR REPLACE VIEW hk_users AS
 SELECT id AS user_id, username, password_hash, role, position, first_name, last_name, email,
 CASE WHEN is_active THEN 'ACTIVE' ELSE 'INACTIVE' END AS employment_status, created_at
 FROM users;
CREATE OR REPLACE VIEW hk_rooms AS
 SELECT id AS room_id, room_number, room_type, floor AS floor_number, status AS room_status, updated_at
 FROM rooms;
CREATE OR REPLACE VIEW hk_guests AS
 SELECT id AS guest_id, first_name, last_name, phone AS contact_number FROM guests;
-- =====================================================================
-- HOSIS - Housekeeping Subsystem Schema
-- Owner: Housekeeping group (BSIT 3 - Alpha)
--
-- Implements the Housekeeping ERD (11 entities) from the subsystem
-- documentation. Tables owned by Housekeeping use the "hk_" prefix so
-- they never collide with tables from other departments.
--
-- STAFF, ROOM and GUEST are shared HOSIS entities owned by other groups
-- (01-users.sql, 04-rooms.sql, 03-guests.sql). Load those first. The
-- columns Housekeeping needs from them are listed in
-- docs/housekeeping/INTEGRATION.md.
--
-- Running the Housekeeping module on its own? Load
-- database/standalone/00-shared-tables.sql first. Never load that file
-- in the combined HOSIS database.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Housekeeping tables
-- ---------------------------------------------------------------------

-- ROOM_STATUS_LOG: every room status change, who made it and when (HK-003).
CREATE TABLE IF NOT EXISTS hk_room_status_logs (
    log_id          SERIAL PRIMARY KEY,
    room_id         BIGINT         NOT NULL REFERENCES rooms(id),
    staff_id        BIGINT         REFERENCES users(id),
    previous_status VARCHAR(20) NOT NULL,
    new_status      VARCHAR(20) NOT NULL,
    remarks         VARCHAR(255),
    changed_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- CLEANING_TASK: a cleaning assignment for a room (HK-004 to HK-006).
CREATE TABLE IF NOT EXISTS hk_cleaning_tasks (
    task_id         SERIAL PRIMARY KEY,
    room_id         BIGINT         NOT NULL REFERENCES rooms(id),
    staff_id        BIGINT         REFERENCES users(id),
    task_type       VARCHAR(30) NOT NULL
        CHECK (task_type IN ('CHECKOUT', 'STAYOVER', 'DEEP_CLEAN', 'TOUCH_UP', 'POST_REPAIR')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    task_status     VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (task_status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED',
                               'INSPECTED', 'RETURNED')),
    notes           VARCHAR(255),
    reservation_reference VARCHAR(100),
    assigned_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
    due_time        TIME,
    start_time      TIMESTAMP,
    completion_time TIMESTAMP,
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- INSPECTION: result of inspecting a cleaning task. A task can be
-- inspected again after it is returned for re-cleaning (HK-007).
CREATE TABLE IF NOT EXISTS hk_inspections (
    inspection_id     SERIAL PRIMARY KEY,
    task_id           INT         NOT NULL REFERENCES hk_cleaning_tasks(task_id),
    inspected_by      BIGINT         NOT NULL REFERENCES users(id),
    inspection_result VARCHAR(10) NOT NULL CHECK (inspection_result IN ('PASSED', 'FAILED')),
    checklist         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    remarks           VARCHAR(255),
    inspected_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- SCHEDULE: shift and work area entries for staff (HK-008, HK-009).
CREATE TABLE IF NOT EXISTS hk_schedules (
    schedule_id   SERIAL PRIMARY KEY,
    staff_id      BIGINT         NOT NULL REFERENCES users(id),
    shift_date    DATE        NOT NULL,
    shift         VARCHAR(20) NOT NULL CHECK (shift IN ('MORNING', 'AFTERNOON', 'NIGHT')),
    start_time    TIME        NOT NULL,
    end_time      TIME        NOT NULL,
    assigned_area VARCHAR(100) NOT NULL,
    notes         VARCHAR(255),
    UNIQUE (staff_id, shift_date, shift)
);

-- GUEST_REQUEST: housekeeping requests from guests (HK-013, HK-014).
CREATE TABLE IF NOT EXISTS hk_guest_requests (
    request_id       SERIAL PRIMARY KEY,
    guest_id         BIGINT          REFERENCES guests(id),
    room_id          BIGINT          NOT NULL REFERENCES rooms(id),
    staff_id         BIGINT          REFERENCES users(id),
    request_type     VARCHAR(30)  NOT NULL
        CHECK (request_type IN ('TOWELS', 'AMENITIES', 'EXTRA_BED', 'CLEANING', 'LAUNDRY', 'OTHER')),
    priority         VARCHAR(10)  NOT NULL DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    request_details  VARCHAR(255) NOT NULL,
    reservation_reference VARCHAR(100),
    request_status   VARCHAR(20)  NOT NULL DEFAULT 'OPEN'
        CHECK (request_status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED')),
    completion_notes VARCHAR(255),
    requested_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMP
);

-- LOST_FOUND_ITEM: items found in rooms, stored under a label (HK-010, HK-011).
CREATE TABLE IF NOT EXISTS hk_lost_found_items (
    item_id          SERIAL PRIMARY KEY,
    room_id          BIGINT          REFERENCES rooms(id),
    found_by         BIGINT          NOT NULL REFERENCES users(id),
    item_description VARCHAR(255) NOT NULL,
    found_location   VARCHAR(100) NOT NULL,
    storage_label    VARCHAR(30)  NOT NULL UNIQUE,
    storage_location VARCHAR(100) NOT NULL,
    item_status      VARCHAR(20)  NOT NULL DEFAULT 'STORED'
        CHECK (item_status IN ('STORED', 'RELEASED', 'DISPOSED')),
    found_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ITEM_CLAIM: claims on found items. An item is released only for a
-- VALID claim; rejected claims stay on record (HK-012).
CREATE TABLE IF NOT EXISTS hk_item_claims (
    claim_id           SERIAL PRIMARY KEY,
    item_id            INT          NOT NULL REFERENCES hk_lost_found_items(item_id),
    guest_id           BIGINT          REFERENCES guests(id),
    claimant_name      VARCHAR(100) NOT NULL,
    claimant_contact   VARCHAR(100) NOT NULL,
    id_verified        BOOLEAN      NOT NULL DEFAULT FALSE,
    description_match  BOOLEAN      NOT NULL DEFAULT FALSE,
    processed_by       BIGINT          NOT NULL REFERENCES users(id),
    claim_status       VARCHAR(10)  NOT NULL CHECK (claim_status IN ('VALID', 'REJECTED')),
    claimed_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
    released_at        TIMESTAMP
);

-- MAINTENANCE_REQUEST: room issues reported to Engineering (HK-015).
CREATE TABLE IF NOT EXISTS hk_maintenance_requests (
    request_id        SERIAL PRIMARY KEY,
    room_id           BIGINT          NOT NULL REFERENCES rooms(id),
    reported_by       BIGINT          NOT NULL REFERENCES users(id),
    issue_category    VARCHAR(30)  NOT NULL
        CHECK (issue_category IN ('PLUMBING', 'ELECTRICAL', 'AIRCON', 'FURNITURE',
                                  'APPLIANCE', 'OTHER')),
    issue_description VARCHAR(255) NOT NULL,
    priority          VARCHAR(10)  NOT NULL DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    status            VARCHAR(20)  NOT NULL DEFAULT 'REPORTED'
        CHECK (status IN ('REPORTED', 'IN_PROGRESS', 'REPAIRED', 'CLOSED')),
    room_set_ooo      BOOLEAN      NOT NULL DEFAULT FALSE,
    reported_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    resolved_at       TIMESTAMP
);

-- Front Office notifications raised by Housekeeping: ROOM_READY when a room
-- passes inspection and is ready to be released (flowchart: "Notify Front
-- Office of Room Availability"), ROOM_CONDITION when a staff member reports
-- a room's condition (damage, missing items, smoking, ...) to Front Office.
CREATE TABLE IF NOT EXISTS hk_front_office_notifications (
    notification_id SERIAL PRIMARY KEY,
    room_id         BIGINT          NOT NULL REFERENCES rooms(id),
    notice_type     VARCHAR(20)  NOT NULL DEFAULT 'ROOM_READY'
        CHECK (notice_type IN ('ROOM_READY', 'ROOM_CONDITION')),
    message         VARCHAR(255) NOT NULL,
    created_by      BIGINT          REFERENCES users(id),
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    read_at         TIMESTAMP
);

-- Databases created before notice_type existed get the column here.
ALTER TABLE hk_front_office_notifications
    ADD COLUMN IF NOT EXISTS notice_type VARCHAR(20) NOT NULL DEFAULT 'ROOM_READY'
        CHECK (notice_type IN ('ROOM_READY', 'ROOM_CONDITION'));

-- ---------------------------------------------------------------------
-- Additions from the November 2026 audit
-- ---------------------------------------------------------------------

-- Lost & found: who disposed of an item, when and why.
ALTER TABLE hk_cleaning_tasks ADD COLUMN IF NOT EXISTS reservation_reference VARCHAR(100);
ALTER TABLE hk_guest_requests ADD COLUMN IF NOT EXISTS reservation_reference VARCHAR(100);

ALTER TABLE hk_lost_found_items ADD COLUMN IF NOT EXISTS disposed_by     BIGINT REFERENCES users(id);
ALTER TABLE hk_lost_found_items ADD COLUMN IF NOT EXISTS disposed_at     TIMESTAMP;
ALTER TABLE hk_lost_found_items ADD COLUMN IF NOT EXISTS disposal_reason VARCHAR(255);

-- Stable public lookup code for the permanent QR label. Opening or printing a
-- label never changes this random identifier.
ALTER TABLE hk_lost_found_items ADD COLUMN IF NOT EXISTS public_code VARCHAR(36);
ALTER TABLE hk_lost_found_items ALTER COLUMN public_code
    SET DEFAULT md5(random()::text || clock_timestamp()::text);
UPDATE hk_lost_found_items
   SET public_code = md5(random()::text || clock_timestamp()::text || item_id::text)
 WHERE public_code IS NULL;
ALTER TABLE hk_lost_found_items ALTER COLUMN public_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hk_lost_found_public_code
    ON hk_lost_found_items (public_code);

-- Item claims: which ID the claimant showed. Only the last 4 characters of
-- the ID number are kept, so the record does not hold a full ID number.
ALTER TABLE hk_item_claims ADD COLUMN IF NOT EXISTS id_type       VARCHAR(30);
ALTER TABLE hk_item_claims ADD COLUMN IF NOT EXISTS id_last4      VARCHAR(4);

-- Photos of found items (stored in the database, JPEG/PNG/WebP, up to 2 MB).
CREATE TABLE IF NOT EXISTS hk_lost_found_photos (
    photo_id     SERIAL PRIMARY KEY,
    item_id      INT          NOT NULL REFERENCES hk_lost_found_items(item_id) ON DELETE CASCADE,
    content_type VARCHAR(30)  NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    data         BYTEA        NOT NULL,
    uploaded_by  BIGINT          NOT NULL REFERENCES users(id),
    uploaded_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hk_staff_profile_photos (
    user_id      BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(30) NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    data         BYTEA       NOT NULL,
    updated_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Failed sign-ins, kept in the database so the lockout survives a restart.
CREATE TABLE IF NOT EXISTS hk_login_failures (
    attempt_key  VARCHAR(200) PRIMARY KEY,
    failures     INT          NOT NULL DEFAULT 1,
    first_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Forgot password: a staff member asks, a supervisor sets a temporary
-- password, and the staff member must choose a new one at the next sign-in.
CREATE TABLE IF NOT EXISTS hk_password_resets (
    reset_id      SERIAL PRIMARY KEY,
    user_id       BIGINT          NOT NULL REFERENCES users(id),
    status        VARCHAR(20)  NOT NULL DEFAULT 'REQUESTED'
        CHECK (status IN ('REQUESTED', 'DONE', 'DISMISSED')),
    requested_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    handled_by    BIGINT          REFERENCES users(id),
    handled_at    TIMESTAMP
);

-- Accounts that must change their password at the next sign-in.
CREATE TABLE IF NOT EXISTS hk_password_must_change (
    user_id  INT PRIMARY KEY REFERENCES users(id),
    set_by   BIGINT REFERENCES users(id),
    set_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- INVENTORY_ITEM: linen, guest amenities and cleaning supplies.
CREATE TABLE IF NOT EXISTS hk_inventory_items (
    inv_item_id   SERIAL PRIMARY KEY,
    item_name     VARCHAR(100) NOT NULL UNIQUE,
    category      VARCHAR(20)  NOT NULL CHECK (category IN ('LINEN', 'AMENITY', 'CLEANING_SUPPLY')),
    unit          VARCHAR(20)  NOT NULL,
    quantity      INT          NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reorder_level INT          NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    storage_area  VARCHAR(100),
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- INVENTORY_MOVEMENT: every stock change. IN = delivery or laundry return,
-- OUT = used in a room or sent to laundry, ADJUST = stock count correction.
CREATE TABLE IF NOT EXISTS hk_inventory_movements (
    movement_id   SERIAL PRIMARY KEY,
    inv_item_id   INT          NOT NULL REFERENCES hk_inventory_items(inv_item_id),
    movement_type VARCHAR(10)  NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUST')),
    quantity      INT          NOT NULL,
    balance_after INT          NOT NULL CHECK (balance_after >= 0),
    room_id       BIGINT          REFERENCES rooms(id),
    remarks       VARCHAR(255),
    staff_id      BIGINT          NOT NULL REFERENCES users(id),
    moved_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Guest requests that need stock (e.g. 2 bath towels): the item and amount,
-- and when the stock was approved and taken out of inventory.
ALTER TABLE hk_guest_requests ADD COLUMN IF NOT EXISTS inv_item_id        INT REFERENCES hk_inventory_items(inv_item_id);
ALTER TABLE hk_guest_requests ADD COLUMN IF NOT EXISTS quantity_requested INT CHECK (quantity_requested > 0);
ALTER TABLE hk_guest_requests ADD COLUMN IF NOT EXISTS stock_approved_at  TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_hk_inv_moves_item  ON hk_inventory_movements (inv_item_id);
CREATE INDEX IF NOT EXISTS idx_hk_logs_changed    ON hk_room_status_logs (changed_at);

CREATE INDEX IF NOT EXISTS idx_hk_tasks_status   ON hk_cleaning_tasks (task_status);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_staff    ON hk_cleaning_tasks (staff_id);
CREATE INDEX IF NOT EXISTS idx_hk_logs_room      ON hk_room_status_logs (room_id);
CREATE INDEX IF NOT EXISTS idx_hk_schedules_date ON hk_schedules (shift_date);
CREATE INDEX IF NOT EXISTS idx_hk_requests_state ON hk_guest_requests (request_status);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_reservation ON hk_cleaning_tasks (reservation_reference)
    WHERE reservation_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hk_requests_reservation ON hk_guest_requests (reservation_reference)
    WHERE reservation_reference IS NOT NULL;

-- Serialize duplicate submissions and preserve one active task per room.
CREATE UNIQUE INDEX IF NOT EXISTS hk_one_active_task ON hk_cleaning_tasks(room_id)
 WHERE task_status <> 'INSPECTED';
CREATE UNIQUE INDEX IF NOT EXISTS hk_one_open_password_reset ON hk_password_resets(user_id)
 WHERE status = 'REQUESTED';
ALTER TABLE hk_guest_requests ADD COLUMN IF NOT EXISTS front_office_request_id BIGINT UNIQUE REFERENCES guest_requests(id);
ALTER TABLE hk_guest_requests ALTER COLUMN request_details TYPE TEXT;

-- Every edit to a canonical request is mirrored in the same transaction.
CREATE OR REPLACE FUNCTION sync_front_office_request() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
 IF NEW.room_id IS NULL THEN RETURN NEW; END IF;
 INSERT INTO hk_guest_requests (front_office_request_id, guest_id, room_id, request_type, priority, request_details, request_status)
 VALUES (NEW.id, NEW.guest_id, NEW.room_id, 'OTHER',
  CASE WHEN NEW.priority = 'URGENT' THEN 'URGENT' ELSE 'NORMAL' END, NEW.request_text,
  CASE NEW.status WHEN 'NEW' THEN 'OPEN' ELSE NEW.status END)
 ON CONFLICT (front_office_request_id) DO UPDATE SET
  guest_id = EXCLUDED.guest_id, room_id = EXCLUDED.room_id, priority = EXCLUDED.priority,
  request_details = EXCLUDED.request_details, request_status = EXCLUDED.request_status;
 RETURN NEW;
END $$;
CREATE TRIGGER front_office_request_sync AFTER INSERT OR UPDATE ON guest_requests
 FOR EACH ROW EXECUTE FUNCTION sync_front_office_request();

CREATE OR REPLACE FUNCTION sync_housekeeping_request() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF pg_trigger_depth() > 1 OR NEW.front_office_request_id IS NULL THEN RETURN NEW; END IF;
 UPDATE guest_requests SET request_text = NEW.request_details,
  priority = CASE WHEN NEW.priority = 'URGENT' THEN 'URGENT' ELSE 'STANDARD' END,
  status = CASE NEW.request_status WHEN 'OPEN' THEN 'NEW' ELSE NEW.request_status END, updated_at = NOW()
 WHERE id = NEW.front_office_request_id;
 RETURN NEW;
END $$;
CREATE TRIGGER housekeeping_request_sync AFTER UPDATE ON hk_guest_requests
 FOR EACH ROW EXECUTE FUNCTION sync_housekeeping_request();
-- Backfill open room-linked Front Office requests without changing their data.
INSERT INTO hk_guest_requests (front_office_request_id,guest_id,room_id,request_type,priority,request_details,request_status)
 SELECT id,guest_id,room_id,'OTHER',CASE WHEN priority='URGENT' THEN 'URGENT' ELSE 'NORMAL' END,
 request_text,CASE status WHEN 'NEW' THEN 'OPEN' ELSE status END FROM guest_requests WHERE room_id IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('14-housekeeping-integration.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 15-auth-hardening.sql
-- ====================================================================
CREATE TABLE auth_attempts (
 attempt_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 1, first_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX auth_attempts_time_idx ON auth_attempts(first_at);
-- Password updates revoke every existing token, including supervisor resets.
CREATE FUNCTION revoke_changed_password() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.password_hash IS DISTINCT FROM OLD.password_hash AND NEW.session_version = OLD.session_version THEN
  NEW.session_version := OLD.session_version + 1;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER users_revoke_password BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION revoke_changed_password();

INSERT INTO schema_migrations (filename) VALUES ('15-auth-hardening.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 16-payment-idempotency.sql
-- ====================================================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS request_key VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS payments_request_key_unique
    ON payments (invoice_id, request_key) WHERE request_key IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('16-payment-idempotency.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 17-human-resources.sql
-- ====================================================================
CREATE TABLE hr_employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dept TEXT NOT NULL,
  pos TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Regular', 'Probationary', 'Contractual')),
  hired DATE NOT NULL,
  rate INTEGER NOT NULL CHECK (rate >= 0),
  assignment TEXT NOT NULL,
  week JSONB NOT NULL,
  today TEXT NOT NULL,
  time_in TEXT NOT NULL,
  days INTEGER NOT NULL DEFAULT 0,
  late INTEGER NOT NULL DEFAULT 0,
  absences INTEGER NOT NULL DEFAULT 0,
  overtime INTEGER NOT NULL DEFAULT 0,
  contact TEXT NOT NULL,
  quals JSONB NOT NULL DEFAULT '[]'::jsonb,
  license TEXT,
  spec TEXT
);

CREATE TABLE hr_leave_requests (
  id TEXT PRIMARY KEY,
  emp TEXT NOT NULL REFERENCES hr_employees(id),
  type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  days INTEGER NOT NULL CHECK (days > 0),
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  reason TEXT NOT NULL
);

CREATE TABLE hr_assignment_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE NOT NULL,
  emp TEXT NOT NULL REFERENCES hr_employees(id),
  dept TEXT NOT NULL,
  from_value TEXT NOT NULL,
  to_value TEXT NOT NULL,
  by_user TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE hr_maintenance_requirements (
  area TEXT PRIMARY KEY,
  need INTEGER NOT NULL CHECK (need >= 0)
);

CREATE INDEX hr_leave_requests_emp_dates_idx ON hr_leave_requests (emp, start_date, end_date);
CREATE INDEX hr_assignment_logs_emp_date_idx ON hr_assignment_logs (emp, date DESC);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
    GRANT SELECT ON hr_employees, hr_leave_requests, hr_assignment_logs, hr_maintenance_requirements TO hosis_runtime;
    GRANT UPDATE (assignment, week) ON hr_employees TO hosis_runtime;
    GRANT UPDATE (status) ON hr_leave_requests TO hosis_runtime;
    GRANT INSERT ON hr_assignment_logs TO hosis_runtime;
    GRANT USAGE ON SEQUENCE hr_assignment_logs_id_seq TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('17-human-resources.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 18-engineering-workspace.sql
-- ====================================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN
  ('ADMIN', 'SUPER_ADMIN', 'FRONT_OFFICE', 'HOUSEKEEPING', 'HR', 'FINANCE', 'SALES_MARKETING', 'ENGINEERING', 'TECHNICIAN', 'OFFICER', 'HEAD', 'DEPARTMENT_HEAD', 'FOOD_BEVERAGE'));

CREATE SCHEMA IF NOT EXISTS engineering;
CREATE TABLE IF NOT EXISTS engineering.engineering_records (
    collection TEXT NOT NULL CHECK (collection IN (
        'requests', 'orders', 'history', 'equipment', 'rooms', 'activity', 'schedules', 'parts', 'inspections', 'finance', 'usage', 'expenses'
    )),
    record_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    PRIMARY KEY (collection, record_id)
);
CREATE INDEX IF NOT EXISTS engineering_records_payload_idx
    ON engineering.engineering_records USING GIN (payload);
CREATE TABLE IF NOT EXISTS engineering.engineering_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision BIGINT NOT NULL DEFAULT 0
);
INSERT INTO engineering.engineering_state (id, revision) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS engineering.engineering_audit (
    id BIGSERIAL PRIMARY KEY,
    actor_id BIGINT REFERENCES public.users(id),
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    collection TEXT NOT NULL,
    record_id TEXT NOT NULL,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS engineering_audit_created_idx ON engineering.engineering_audit (created_at DESC);
CREATE TABLE IF NOT EXISTS engineering.engineering_notifications (
    id BIGSERIAL PRIMARY KEY, part_id TEXT NOT NULL, message TEXT NOT NULL,
    quantity BIGINT NOT NULL, threshold BIGINT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS engineering_notification_active_part ON engineering.engineering_notifications(part_id) WHERE active;
CREATE TABLE IF NOT EXISTS engineering.engineering_notification_reads (
    notification_id BIGINT REFERENCES engineering.engineering_notifications(id), user_id BIGINT REFERENCES public.users(id),
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(notification_id,user_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
    GRANT USAGE ON SCHEMA engineering TO hosis_runtime;
    GRANT SELECT, INSERT, UPDATE ON engineering.engineering_records, engineering.engineering_state,
        engineering.engineering_audit, engineering.engineering_notifications,
        engineering.engineering_notification_reads TO hosis_runtime;
    GRANT USAGE ON SEQUENCE engineering.engineering_audit_id_seq,
        engineering.engineering_notifications_id_seq TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('18-engineering-workspace.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 19-department-integration.sql
-- ====================================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN
  ('ADMIN', 'SUPER_ADMIN', 'FRONT_OFFICE', 'HOUSEKEEPING', 'HR', 'FINANCE', 'FOOD_BEVERAGE',
   'SALES_MARKETING', 'ENGINEERING', 'TECHNICIAN', 'OFFICER', 'HEAD', 'DEPARTMENT_HEAD'));

ALTER TABLE hr_employees ADD COLUMN staff_user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE sales_marketing_records (
  kind TEXT NOT NULL CHECK (kind IN ('campaign','inquiry','lead','client','promotion','sale')),
  id TEXT NOT NULL,
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (kind, id)
);

CREATE TABLE food_service_orders (
  id UUID PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservations(id),
  invoice_id BIGINT NOT NULL UNIQUE REFERENCES invoices(id),
  item TEXT NOT NULL CHECK (length(item) BETWEEN 1 AND 120),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price > 0),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON sales_marketing_records TO hosis_runtime;
    GRANT SELECT, INSERT ON food_service_orders TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('19-department-integration.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 20-sam-finance.sql
-- ====================================================================
-- Finance & Accounting Subsystem Schema
-- Implements FIN-001 through FIN-013

CREATE TABLE IF NOT EXISTS finance_invoices (
    id BIGSERIAL PRIMARY KEY,
    invoice_code VARCHAR(40) NOT NULL UNIQUE,
    guest_name VARCHAR(200) NOT NULL,
    guest_email VARCHAR(254),
    reservation_code VARCHAR(50),
    room_number VARCHAR(40),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    vat NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (vat >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance_due >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PART_PAID', 'PAID', 'VOID')),
    issue_date DATE,
    due_date DATE,
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS finance_invoices_status_idx ON finance_invoices (status);
CREATE INDEX IF NOT EXISTS finance_invoices_guest_idx ON finance_invoices (guest_name);

CREATE TABLE IF NOT EXISTS finance_invoice_items (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES finance_invoices(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
    source VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS finance_invoice_items_invoice_idx ON finance_invoice_items (invoice_id);

CREATE TABLE IF NOT EXISTS finance_payments (
    id BIGSERIAL PRIMARY KEY,
    receipt_code VARCHAR(40) NOT NULL UNIQUE,
    invoice_id BIGINT REFERENCES finance_invoices(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(40) NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER')),
    reference VARCHAR(120) NOT NULL,
    notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REFUNDED', 'DISPUTED')),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS finance_payments_invoice_idx ON finance_payments (invoice_id);

CREATE TABLE IF NOT EXISTS finance_expenses (
    id BIGSERIAL PRIMARY KEY,
    voucher_code VARCHAR(40) NOT NULL UNIQUE,
    department VARCHAR(80) NOT NULL,
    category VARCHAR(120) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PAID', 'REJECTED')),
    approved_by VARCHAR(100),
    notes TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS finance_expenses_status_idx ON finance_expenses (status);

CREATE TABLE IF NOT EXISTS finance_payroll (
    id BIGSERIAL PRIMARY KEY,
    payroll_code VARCHAR(40) NOT NULL UNIQUE,
    employee_id VARCHAR(40) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    department VARCHAR(80) NOT NULL,
    role_title VARCHAR(100) NOT NULL,
    regular_hours NUMERIC(6, 2) NOT NULL DEFAULT 80.00,
    overtime_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    basic_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    overtime_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gross_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    withholding_tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sss_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    philhealth_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    pagibig_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_payable NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'DISBURSED')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_audit_log (
    id BIGSERIAL PRIMARY KEY,
    transaction_code VARCHAR(40) NOT NULL UNIQUE,
    activity VARCHAR(100) NOT NULL,
    reference_code VARCHAR(80),
    amount NUMERIC(12, 2),
    amount_label VARCHAR(80),
    source VARCHAR(80) NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS finance_audit_log_created_idx ON finance_audit_log (created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON finance_invoices, finance_payments, finance_expenses TO hosis_runtime;
    GRANT SELECT, INSERT ON finance_invoice_items, finance_audit_log TO hosis_runtime;
    GRANT SELECT ON finance_payroll TO hosis_runtime;
    GRANT USAGE ON SEQUENCE finance_invoices_id_seq, finance_payments_id_seq,
      finance_expenses_id_seq, finance_invoice_items_id_seq, finance_audit_log_id_seq TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('20-sam-finance.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 21-housekeeping-cross-subsystem.sql
-- ====================================================================
-- Additive Housekeeping bridges for the subsystem implementations currently in
-- the main HOSIS repository. This migration intentionally avoids changing
-- another department's tables or workflow rules.

-- Repeat the November Housekeeping additions in a new migration. Some shared
-- databases applied migration 14 before these columns were added to its file.
ALTER TABLE hk_cleaning_tasks ADD COLUMN IF NOT EXISTS reservation_reference VARCHAR(100);
ALTER TABLE hk_guest_requests ADD COLUMN IF NOT EXISTS reservation_reference VARCHAR(100);

ALTER TABLE hk_lost_found_items ADD COLUMN IF NOT EXISTS public_code VARCHAR(36);
ALTER TABLE hk_lost_found_items ALTER COLUMN public_code
  SET DEFAULT md5(random()::text || clock_timestamp()::text);
UPDATE hk_lost_found_items
   SET public_code = md5(random()::text || clock_timestamp()::text || item_id::text)
 WHERE public_code IS NULL;
ALTER TABLE hk_lost_found_items ALTER COLUMN public_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hk_lost_found_public_code
  ON hk_lost_found_items (public_code);

CREATE TABLE IF NOT EXISTS hk_staff_profile_photos (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(30) NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  data BYTEA NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hk_tasks_reservation
  ON hk_cleaning_tasks (reservation_reference)
  WHERE reservation_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hk_requests_reservation
  ON hk_guest_requests (reservation_reference)
  WHERE reservation_reference IS NOT NULL;

-- Front Office owns reservations. Preserve its real confirmation code when a
-- checked-in stay is converted into a checkout cleaning task.
CREATE OR REPLACE FUNCTION bridge_front_office_checkout_to_housekeeping()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'CHECKED_OUT'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.room_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM rooms WHERE id = NEW.room_id AND status = 'DIRTY') THEN
    INSERT INTO hk_cleaning_tasks
      (room_id, task_type, priority, notes, reservation_reference)
    VALUES
      (NEW.room_id, 'CHECKOUT', 'NORMAL', 'Guest checked out', NEW.confirmation_code)
    ON CONFLICT (room_id) WHERE task_status <> 'INSPECTED' DO UPDATE SET
      task_type = 'CHECKOUT',
      task_status = CASE WHEN hk_cleaning_tasks.staff_id IS NULL THEN 'PENDING' ELSE 'ASSIGNED' END,
      reservation_reference = EXCLUDED.reservation_reference,
      start_time = NULL,
      completion_time = NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS front_office_checkout_housekeeping_bridge ON reservations;
CREATE TRIGGER front_office_checkout_housekeeping_bridge
AFTER UPDATE OF status ON reservations
FOR EACH ROW EXECUTE FUNCTION bridge_front_office_checkout_to_housekeeping();

-- Use the checked-in reservation belonging to the same room/guest when Front
-- Office sends a room-linked guest request into Housekeeping.
CREATE OR REPLACE FUNCTION sync_front_office_request() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  reservation_code TEXT;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.room_id IS NULL THEN RETURN NEW; END IF;

  SELECT r.confirmation_code INTO reservation_code
    FROM reservations r
   WHERE r.room_id = NEW.room_id
     AND r.status = 'CHECKED_IN'
     AND (NEW.guest_id IS NULL OR r.guest_id = NEW.guest_id)
   ORDER BY r.updated_at DESC, r.id DESC
   LIMIT 1;

  INSERT INTO hk_guest_requests
    (front_office_request_id, guest_id, room_id, request_type, priority,
     request_details, request_status, reservation_reference)
  VALUES
    (NEW.id, NEW.guest_id, NEW.room_id, 'OTHER',
     CASE WHEN NEW.priority = 'URGENT' THEN 'URGENT' ELSE 'NORMAL' END,
     NEW.request_text, CASE NEW.status WHEN 'NEW' THEN 'OPEN' ELSE NEW.status END,
     reservation_code)
  ON CONFLICT (front_office_request_id) DO UPDATE SET
    guest_id = EXCLUDED.guest_id,
    room_id = EXCLUDED.room_id,
    priority = EXCLUDED.priority,
    request_details = EXCLUDED.request_details,
    request_status = EXCLUDED.request_status,
    reservation_reference = COALESCE(EXCLUDED.reservation_reference, hk_guest_requests.reservation_reference);
  RETURN NEW;
END $$;

-- Housekeeping maintenance reports appear directly in the Engineering
-- workspace. Engineering retains ownership of approval, assignment and work
-- orders; this bridge only creates the incoming request and mirrors its status.
CREATE OR REPLACE FUNCTION bridge_hk_maintenance_to_engineering()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  request_key TEXT := 'HK-MR-' || NEW.request_id::text;
  room_record RECORD;
  reporter_record RECORD;
  hotel_record RECORD;
  engineering_status TEXT;
  request_payload JSONB;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  SELECT id, room_number INTO room_record FROM rooms WHERE id = NEW.room_id;
  SELECT id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), username) AS name
    INTO reporter_record FROM users WHERE id = NEW.reported_by;
  SELECT id, hotel_name AS name INTO hotel_record FROM hotel_settings WHERE id = 1;

  engineering_status := 'Pending';

  request_payload := jsonb_build_object(
    'id', request_key,
    'room', room_record.room_number,
    'roomId', room_record.id::text,
    'locationType', 'Room',
    'issue', REPLACE(INITCAP(NEW.issue_category), '_', ' '),
    'description', NEW.issue_description,
    'priority', CASE NEW.priority WHEN 'LOW' THEN 'Low' WHEN 'NORMAL' THEN 'Medium'
                     WHEN 'HIGH' THEN 'High' ELSE 'Urgent' END,
    'status', engineering_status,
    'date', TO_CHAR(NEW.reported_at, 'YYYY-MM-DD'),
    'by', reporter_record.name,
    'reportedByStaffId', reporter_record.id::text,
    'source', 'Housekeeping',
    'externalRequestId', NEW.request_id::text,
    'hotelId', hotel_record.id::text,
    'hotelName', hotel_record.name
  );

  INSERT INTO engineering.engineering_records (collection, record_id, payload)
  VALUES ('requests', request_key, request_payload)
  ON CONFLICT (collection, record_id) DO UPDATE SET payload =
    engineering.engineering_records.payload || jsonb_build_object(
      'issue', request_payload->>'issue',
      'description', request_payload->>'description',
      'priority', request_payload->>'priority'
    );

  IF TG_OP = 'INSERT' THEN
    UPDATE engineering.engineering_state SET revision = revision + 1 WHERE id = 1;
    INSERT INTO engineering.engineering_audit
      (actor_id, actor_name, action, collection, record_id, after_data)
    VALUES
      (NEW.reported_by, reporter_record.name, 'IMPORTED_FROM_HOUSEKEEPING',
       'requests', request_key, request_payload);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS hk_maintenance_engineering_bridge ON hk_maintenance_requests;
CREATE TRIGGER hk_maintenance_engineering_bridge
AFTER INSERT OR UPDATE OF issue_category, issue_description, priority, status
ON hk_maintenance_requests
FOR EACH ROW EXECUTE FUNCTION bridge_hk_maintenance_to_engineering();

CREATE OR REPLACE FUNCTION bridge_engineering_status_to_housekeeping()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  hk_id INTEGER;
  next_status TEXT;
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.collection <> 'requests'
     OR NEW.record_id !~ '^HK-MR-[0-9]+$' THEN
    RETURN NEW;
  END IF;

  hk_id := SUBSTRING(NEW.record_id FROM 7)::integer;
  next_status := CASE NEW.payload->>'status'
    WHEN 'Approved' THEN 'IN_PROGRESS'
    WHEN 'Assigned' THEN 'IN_PROGRESS'
    WHEN 'Completed' THEN 'REPAIRED'
    ELSE NULL
  END;

  IF next_status IS NOT NULL THEN
    UPDATE hk_maintenance_requests
       SET status = next_status,
           resolved_at = CASE WHEN next_status = 'REPAIRED' THEN NOW() ELSE NULL END
     WHERE request_id = hk_id AND status <> 'CLOSED';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS engineering_housekeeping_status_bridge
  ON engineering.engineering_records;
CREATE TRIGGER engineering_housekeeping_status_bridge
AFTER INSERT OR UPDATE OF payload ON engineering.engineering_records
FOR EACH ROW EXECUTE FUNCTION bridge_engineering_status_to_housekeeping();

-- Import already-open Housekeeping reports without overwriting requests that
-- Engineering has begun processing.
INSERT INTO engineering.engineering_records (collection, record_id, payload)
SELECT 'requests', 'HK-MR-' || m.request_id::text,
       jsonb_build_object(
         'id', 'HK-MR-' || m.request_id::text,
         'room', r.room_number,
         'roomId', r.id::text,
         'locationType', 'Room',
         'issue', REPLACE(INITCAP(m.issue_category), '_', ' '),
         'description', m.issue_description,
         'priority', CASE m.priority WHEN 'LOW' THEN 'Low' WHEN 'NORMAL' THEN 'Medium'
                          WHEN 'HIGH' THEN 'High' ELSE 'Urgent' END,
         'status', 'Pending',
         'date', TO_CHAR(m.reported_at, 'YYYY-MM-DD'),
         'by', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.username),
         'reportedByStaffId', u.id::text,
         'source', 'Housekeeping',
         'externalRequestId', m.request_id::text,
         'hotelId', h.id::text,
         'hotelName', h.hotel_name
       )
  FROM hk_maintenance_requests m
  JOIN rooms r ON r.id = m.room_id
  JOIN users u ON u.id = m.reported_by
  JOIN hotel_settings h ON h.id = 1
 WHERE m.status IN ('REPORTED', 'IN_PROGRESS')
ON CONFLICT (collection, record_id) DO NOTHING;

INSERT INTO schema_migrations (filename) VALUES ('21-housekeeping-cross-subsystem.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 22-housekeeping-alert-preferences.sql
-- ====================================================================
-- Per-user state for the Housekeeping notification bell. A cutoff keeps the
-- state compact: alerts at or before read_through are read; newer alerts are
-- unread. Removing the cutoff makes every current alert unread again.
CREATE TABLE IF NOT EXISTS hk_alert_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  read_through TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (filename) VALUES ('22-housekeeping-alert-preferences.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 23-front-office-requirements.sql
-- ====================================================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS promotion JSONB;

ALTER TABLE hk_maintenance_requests ADD COLUMN IF NOT EXISTS report_source TEXT
  NOT NULL DEFAULT 'Housekeeping' CHECK (report_source IN ('Housekeeping', 'Front Office'));

CREATE OR REPLACE FUNCTION bridge_hk_maintenance_to_engineering()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  request_key TEXT := 'HK-MR-' || NEW.request_id::text;
  room_record RECORD;
  reporter_record RECORD;
  hotel_record RECORD;
  engineering_status TEXT;
  request_payload JSONB;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  SELECT id, room_number INTO room_record FROM rooms WHERE id = NEW.room_id;
  SELECT id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), username) AS name
    INTO reporter_record FROM users WHERE id = NEW.reported_by;
  SELECT id, hotel_name AS name INTO hotel_record FROM hotel_settings WHERE id = 1;

  engineering_status := 'Pending';

  request_payload := jsonb_build_object(
    'id', request_key,
    'room', room_record.room_number,
    'roomId', room_record.id::text,
    'locationType', 'Room',
    'issue', REPLACE(INITCAP(NEW.issue_category), '_', ' '),
    'description', NEW.issue_description,
    'priority', CASE NEW.priority WHEN 'LOW' THEN 'Low' WHEN 'NORMAL' THEN 'Medium'
                     WHEN 'HIGH' THEN 'High' ELSE 'Urgent' END,
    'status', engineering_status,
    'date', TO_CHAR(NEW.reported_at, 'YYYY-MM-DD'),
    'by', reporter_record.name,
    'reportedByStaffId', reporter_record.id::text,
    'source', NEW.report_source,
    'externalRequestId', NEW.request_id::text,
    'hotelId', hotel_record.id::text,
    'hotelName', hotel_record.name
  );

  INSERT INTO engineering.engineering_records (collection, record_id, payload)
  VALUES ('requests', request_key, request_payload)
  ON CONFLICT (collection, record_id) DO UPDATE SET payload =
    engineering.engineering_records.payload || jsonb_build_object(
      'issue', request_payload->>'issue',
      'description', request_payload->>'description',
      'priority', request_payload->>'priority'
    );

  IF TG_OP = 'INSERT' THEN
    UPDATE engineering.engineering_state SET revision = revision + 1 WHERE id = 1;
    INSERT INTO engineering.engineering_audit
      (actor_id, actor_name, action, collection, record_id, after_data)
    VALUES
      (NEW.reported_by, reporter_record.name, CASE NEW.report_source WHEN 'Front Office' THEN 'IMPORTED_FROM_FRONT_OFFICE' ELSE 'IMPORTED_FROM_HOUSEKEEPING' END,
       'requests', request_key, request_payload);
  END IF;
  RETURN NEW;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('23-front-office-requirements.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 24-front-office-stay-workflows.sql
-- ====================================================================
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS quoted_promotion JSONB;
ALTER TABLE guest_requests ADD COLUMN IF NOT EXISTS reservation_id BIGINT REFERENCES reservations(id);
CREATE INDEX IF NOT EXISTS invoices_reservation_idx ON invoices(reservation_id) WHERE reservation_id IS NOT NULL;

UPDATE users SET is_active=FALSE, session_version=session_version+1
WHERE role='FOOD_BEVERAGE' AND is_active;

CREATE OR REPLACE FUNCTION sync_front_office_request() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  reservation_code TEXT;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.room_id IS NULL THEN RETURN NEW; END IF;

  SELECT r.confirmation_code INTO reservation_code
    FROM reservations r
   WHERE r.room_id = NEW.room_id
     AND (NEW.reservation_id IS NULL OR r.id = NEW.reservation_id)
     AND r.status = 'CHECKED_IN'
     AND (NEW.guest_id IS NULL OR r.guest_id = NEW.guest_id)
   ORDER BY r.updated_at DESC, r.id DESC
   LIMIT 1;

  INSERT INTO hk_guest_requests
    (front_office_request_id, guest_id, room_id, request_type, priority,
     request_details, request_status, reservation_reference)
  VALUES
    (NEW.id, NEW.guest_id, NEW.room_id, 'OTHER',
     CASE WHEN NEW.priority = 'URGENT' THEN 'URGENT' ELSE 'NORMAL' END,
     NEW.request_text, CASE NEW.status WHEN 'NEW' THEN 'OPEN' ELSE NEW.status END,
     reservation_code)
  ON CONFLICT (front_office_request_id) DO UPDATE SET
    guest_id = EXCLUDED.guest_id,
    room_id = EXCLUDED.room_id,
    priority = EXCLUDED.priority,
    request_details = EXCLUDED.request_details,
    request_status = EXCLUDED.request_status,
    reservation_reference = COALESCE(EXCLUDED.reservation_reference, hk_guest_requests.reservation_reference);
  RETURN NEW;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('24-front-office-stay-workflows.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 25-front-office-housekeeping-handoffs.sql
-- ====================================================================
ALTER TABLE guest_requests ADD COLUMN IF NOT EXISTS due_at TIMESTAMP;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS actual_checkout_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS hk_lost_found_room_date_idx ON hk_lost_found_items(room_id, found_at);
CREATE TABLE IF NOT EXISTS front_office_room_moves (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservations(id),
  from_room_id BIGINT NOT NULL REFERENCES rooms(id),
  to_room_id BIGINT NOT NULL REFERENCES rooms(id),
  moved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_room_id <> to_room_id)
);
CREATE INDEX IF NOT EXISTS front_office_room_moves_stay_idx ON front_office_room_moves(reservation_id);
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
    GRANT SELECT, INSERT ON front_office_room_moves TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('25-front-office-housekeeping-handoffs.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 26-housekeeping-finance-hr-workflows.sql
-- ====================================================================
-- Housekeeping findings routed through Front Office to Finance, plus
-- Housekeeping-originated leave requests reviewed by Human Resources.

CREATE TABLE IF NOT EXISTS hk_charge_findings (
  finding_id BIGSERIAL PRIMARY KEY,
  public_reference VARCHAR(30) NOT NULL UNIQUE DEFAULT
    ('HKF-' || UPPER(SUBSTRING(md5(random()::text || clock_timestamp()::text), 1, 12))),
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  reservation_id BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
  reservation_reference VARCHAR(100),
  category VARCHAR(30) NOT NULL CHECK (category IN
    ('DAMAGE','MISSING_ITEM','LINEN_LOSS','SMOKING','EXCESSIVE_CLEANING','OTHER')),
  description VARCHAR(500) NOT NULL,
  estimated_amount NUMERIC(12,2) CHECK (estimated_amount IS NULL OR estimated_amount >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'REPORTED' CHECK (status IN
    ('REPORTED','FOR_FINANCE','APPROVED','REJECTED','WITHDRAWN')),
  reported_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  front_office_reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  front_office_reviewed_at TIMESTAMPTZ,
  front_office_notes VARCHAR(500),
  finance_decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  finance_decided_at TIMESTAMPTZ,
  final_amount NUMERIC(12,2) CHECK (final_amount IS NULL OR final_amount >= 0),
  finance_notes VARCHAR(500),
  finance_invoice_id BIGINT UNIQUE REFERENCES finance_invoices(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE IF NOT EXISTS hk_charge_finding_events (
  event_id BIGSERIAL PRIMARY KEY,
  finding_id BIGINT NOT NULL REFERENCES hk_charge_findings(finding_id) ON DELETE CASCADE,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  action VARCHAR(40) NOT NULL,
  notes VARCHAR(500),
  actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hk_charge_findings_status_idx
  ON hk_charge_findings(status, reported_at DESC);
CREATE INDEX IF NOT EXISTS hk_charge_findings_room_idx
  ON hk_charge_findings(room_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS hk_charge_findings_reporter_idx
  ON hk_charge_findings(reported_by, reported_at DESC);
CREATE INDEX IF NOT EXISTS hk_charge_finding_events_finding_idx
  ON hk_charge_finding_events(finding_id, created_at, event_id);

-- Every active Housekeeping account needs an HR identity before it can file a
-- leave request. Existing HR records remain authoritative and are not changed.
INSERT INTO hr_employees
  (id, name, dept, pos, status, hired, rate, assignment, week, today,
   time_in, days, late, absences, overtime, contact, quals, staff_user_id)
SELECT 'EMP-HK-' || u.id,
       COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.username),
       'housekeeping', REPLACE(INITCAP(u.position), '_', ' '), 'Regular',
       u.created_at::date, 0, 'Housekeeping',
       '["AM","AM","AM","AM","AM","OFF","OFF"]'::jsonb,
       'Not clocked in', '07:00', 0, 0, 0, 0, COALESCE(u.email, ''), '[]'::jsonb, u.id
  FROM users u
 WHERE u.role = 'HOUSEKEEPING' AND u.is_active
   AND NOT EXISTS (SELECT 1 FROM hr_employees e WHERE e.staff_user_id = u.id)
ON CONFLICT DO NOTHING;

ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS decision_notes VARCHAR(500);
ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS hr_leave_no_overlapping_open_request
  ON hr_leave_requests(emp, start_date, end_date)
  WHERE status IN ('Pending','Approved');

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON hk_charge_findings, hk_charge_finding_events TO hosis_runtime;
    GRANT USAGE ON SEQUENCE hk_charge_findings_finding_id_seq,
      hk_charge_finding_events_event_id_seq TO hosis_runtime;
    GRANT INSERT ON hr_leave_requests TO hosis_runtime;
    GRANT UPDATE (status, decided_at, decided_by, decision_notes, version) ON hr_leave_requests TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('26-housekeeping-finance-hr-workflows.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 27-room-numbers.sql
-- ====================================================================
-- Keep the occupied room-number range unique while preserving every room ID.
UPDATE rooms
SET room_number = CASE room_number
  WHEN 'DEMO-101' THEN '116'
  WHEN 'DEMO-102' THEN '117'
  WHEN 'DEMO-103' THEN '118'
  WHEN 'DEMO-104' THEN '119'
  ELSE substring(room_number FROM 6)
END
WHERE room_number ~ '^DEMO-(10[1-9]|11[0-5])$';

INSERT INTO schema_migrations (filename) VALUES ('27-room-numbers.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 28-front-office-billing-and-report-indexes.sql
-- ====================================================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS charge_type TEXT
  CHECK (charge_type IN ('LODGING','OTHER'));
-- Existing linked invoices predate charge classification.
UPDATE invoices SET charge_type = CASE WHEN reservation_id IS NULL THEN 'OTHER' ELSE 'LODGING' END
WHERE charge_type IS NULL;
ALTER TABLE invoices ALTER COLUMN charge_type SET DEFAULT 'OTHER';
ALTER TABLE invoices ALTER COLUMN charge_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS hk_finding_events_time_idx ON hk_charge_finding_events(created_at DESC);
CREATE INDEX IF NOT EXISTS hk_findings_reservation_invoice_idx ON hk_charge_findings(reservation_id)
  WHERE status='APPROVED' AND finance_invoice_id IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('28-front-office-billing-and-report-indexes.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 29-admin-audit-and-staff-integrity.sql
-- ====================================================================
ALTER TABLE hr_assignment_logs ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ;
ALTER TABLE hr_assignment_logs ALTER COLUMN recorded_at SET DEFAULT NOW();

INSERT INTO front_office_activity(user_id, action, description, created_at)
SELECT NULL, 'SALES_RECORD_CREATED', CONCAT('Created ', s.kind, ' record ', s.id, '.'), s.created_at
FROM sales_marketing_records s
WHERE NOT EXISTS (
  SELECT 1 FROM front_office_activity a WHERE a.action='SALES_RECORD_CREATED'
  AND a.description=CONCAT('Created ', s.kind, ' record ', s.id, '.')
);

CREATE OR REPLACE VIEW admin_activity_events AS
SELECT 'desk-' || a.id AS id,
       CASE WHEN a.action LIKE 'ADMIN_%' THEN 'Administration'
            WHEN a.action LIKE 'HOUSEKEEPING_%' THEN 'Housekeeping'
            WHEN a.action LIKE 'SALES_%' THEN 'Sales & Marketing' ELSE 'Front Office' END AS module,
       a.action, a.description, u.username AS actor, a.created_at
FROM front_office_activity a LEFT JOIN users u ON u.id=a.user_id
UNION ALL
SELECT 'finding-' || e.event_id, 'Housekeeping', e.action,
       CONCAT_WS(': ',f.public_reference,e.notes), u.username, e.created_at
FROM hk_charge_finding_events e
JOIN hk_charge_findings f ON f.finding_id=e.finding_id LEFT JOIN users u ON u.id=e.actor_id
UNION ALL
SELECT 'finance-' || id,'Finance',activity, CONCAT_WS(' / ',transaction_code,reference_code,amount_label),user_name,created_at
FROM finance_audit_log
UNION ALL
SELECT 'engineering-' || id,'Engineering',action,CONCAT_WS(' / ',collection,record_id),actor_name,created_at
FROM engineering.engineering_audit
UNION ALL
SELECT 'hr-assignment-' || id,'Human Resources','ASSIGNMENT_CHANGED',
       CONCAT_WS(' / ',emp,from_value || ' -> ' || to_value,note),by_user,COALESCE(recorded_at,date::timestamptz)
FROM hr_assignment_logs
UNION ALL
SELECT 'hr-leave-' || l.id,'Human Resources','LEAVE_SUBMITTED',
       CONCAT_WS(' / ',l.id,l.emp,l.type),u.username,l.submitted_at
FROM hr_leave_requests l JOIN hr_employees e ON e.id=l.emp LEFT JOIN users u ON u.id=e.staff_user_id
UNION ALL
SELECT 'hr-leave-decision-' || l.id,'Human Resources','LEAVE_' || UPPER(l.status),
       CONCAT_WS(' / ',l.id,l.emp,l.decision_notes),u.username,l.decided_at
FROM hr_leave_requests l LEFT JOIN users u ON u.id=l.decided_by WHERE l.decided_at IS NOT NULL;

CREATE OR REPLACE FUNCTION assert_active_housekeeping_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.staff_id IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'hk_schedules' THEN
    IF NEW.shift_date < CURRENT_DATE THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'hk_cleaning_tasks' THEN
    IF NEW.task_status IN ('COMPLETED','INSPECTED') THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'hk_guest_requests' THEN
    IF NEW.request_status = 'COMPLETED' THEN RETURN NEW; END IF;
  END IF;
  PERFORM id FROM users WHERE id=NEW.staff_id AND role='HOUSEKEEPING' AND is_active FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Open work and future shifts require active Housekeeping staff.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER hk_task_active_staff BEFORE INSERT OR UPDATE OF staff_id,task_status ON hk_cleaning_tasks
FOR EACH ROW EXECUTE FUNCTION assert_active_housekeeping_assignment();
CREATE TRIGGER hk_request_active_staff BEFORE INSERT OR UPDATE OF staff_id,request_status ON hk_guest_requests
FOR EACH ROW EXECUTE FUNCTION assert_active_housekeeping_assignment();
CREATE TRIGGER hk_schedule_active_staff BEFORE INSERT OR UPDATE OF staff_id,shift_date ON hk_schedules
FOR EACH ROW EXECUTE FUNCTION assert_active_housekeeping_assignment();

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='hosis_runtime') THEN
    GRANT SELECT ON admin_activity_events TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('29-admin-audit-and-staff-integrity.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 30-sales-workspace.sql
-- ====================================================================
ALTER TABLE sales_marketing_records
  DROP CONSTRAINT sales_marketing_records_kind_check,
  ADD CONSTRAINT sales_marketing_records_kind_check
    CHECK (kind IN ('campaign','inquiry','lead','client','promotion','sale','quotation','payment')),
  ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN updated_at TIMESTAMPTZ;

ALTER TABLE front_office_activity
  ADD COLUMN sales_record_id TEXT,
  ADD COLUMN sales_kind TEXT,
  ADD COLUMN sales_before JSONB,
  ADD COLUMN sales_after JSONB;

CREATE TABLE sales_notification_reads (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id BIGINT NOT NULL REFERENCES front_office_activity(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_id)
);

CREATE INDEX sales_workspace_activity_idx
  ON front_office_activity (id DESC) WHERE sales_record_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
    GRANT SELECT, INSERT ON sales_notification_reads TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('30-sales-workspace.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 31-sales-staff-positions.sql
-- ====================================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_position_check;

UPDATE users SET position = 'SALES_STAFF'
WHERE role = 'SALES_MARKETING' AND position NOT IN ('SALES_HEAD','SALES_STAFF');

ALTER TABLE users ADD CONSTRAINT users_position_check
  CHECK (position IN ('HOUSEKEEPER','INSPECTOR','SUPERVISOR','TECHNICIAN','SALES_HEAD','SALES_STAFF')
    AND (position NOT IN ('SALES_HEAD','SALES_STAFF') OR role = 'SALES_MARKETING'));

INSERT INTO schema_migrations (filename) VALUES ('31-sales-staff-positions.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 32-sales-operations-handoffs.sql
-- ====================================================================
ALTER TABLE sales_marketing_records ADD COLUMN reservation_id BIGINT REFERENCES reservations(id);
UPDATE sales_marketing_records s SET reservation_id = r.id
FROM reservations r
WHERE s.kind = 'sale' AND NOT s.archived AND s.details->>'reservationRef' = r.confirmation_code;
CREATE UNIQUE INDEX sales_linked_reservation_unique
  ON sales_marketing_records (reservation_id) WHERE kind = 'sale' AND reservation_id IS NOT NULL;

CREATE TABLE sales_preparation_acknowledgments (
  reservation_id BIGINT PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
  room_id BIGINT NOT NULL REFERENCES rooms(id),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  preparation TEXT NOT NULL,
  completed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE VIEW sales_stay_handoffs AS
SELECT s.id AS sale_id, r.id AS reservation_id, r.confirmation_code, r.room_id,
  r.room_type, r.check_in, r.check_out, r.status,
  NULLIF(s.details->>'preparation', '') AS preparation, a.completed_at, a.completed_by
FROM sales_marketing_records s JOIN reservations r ON r.id = s.reservation_id
LEFT JOIN sales_preparation_acknowledgments a ON a.reservation_id = r.id
  AND (a.room_id, a.check_in, a.check_out, a.preparation)
    = (r.room_id, r.check_in, r.check_out, s.details->>'preparation')
WHERE s.kind = 'sale' AND NOT s.archived;

CREATE FUNCTION notify_sales_stay_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.room_id, OLD.check_in, OLD.check_out) IS DISTINCT FROM (NEW.room_id, NEW.check_in, NEW.check_out)
     OR NEW.status = 'CANCELLED' THEN
    DELETE FROM sales_preparation_acknowledgments WHERE reservation_id=NEW.id;
  END IF;
  INSERT INTO front_office_activity
    (action, description, sales_record_id, sales_kind, sales_before, sales_after)
  SELECT CASE WHEN NEW.status = 'CANCELLED' THEN 'SALES_STAY_CANCELLED' ELSE 'SALES_STAY_UPDATED' END,
    CONCAT('Reservation ', NEW.confirmation_code, ': ', REPLACE(INITCAP(NEW.status), '_', ' '),
      ' | ', NEW.check_in, ' to ', NEW.check_out, ' | room ', COALESCE(room.room_number, 'unassigned')),
    s.id, 'sales',
    jsonb_build_object('status', OLD.status, 'checkIn', OLD.check_in, 'checkOut', OLD.check_out,
      'roomId', OLD.room_id, 'roomType', OLD.room_type),
    jsonb_build_object('status', NEW.status, 'checkIn', NEW.check_in, 'checkOut', NEW.check_out,
      'roomId', NEW.room_id, 'roomType', NEW.room_type)
  FROM sales_marketing_records s LEFT JOIN rooms room ON room.id = NEW.room_id
  WHERE s.kind = 'sale' AND s.reservation_id = NEW.id AND NOT s.archived;
  RETURN NEW;
END $$;

CREATE TRIGGER sales_stay_changes
AFTER UPDATE OF status, check_in, check_out, room_id, room_type ON reservations
FOR EACH ROW WHEN (ROW(OLD.status, OLD.check_in, OLD.check_out, OLD.room_id, OLD.room_type)
  IS DISTINCT FROM ROW(NEW.status, NEW.check_in, NEW.check_out, NEW.room_id, NEW.room_type))
EXECUTE FUNCTION notify_sales_stay_change();

ALTER TABLE hk_front_office_notifications
  DROP CONSTRAINT IF EXISTS hk_front_office_notifications_notice_type_check,
  ADD CONSTRAINT hk_front_office_notifications_notice_type_check
    CHECK (notice_type IN ('ROOM_READY','ROOM_CONDITION','SALES_PREPARATION','REQUEST_COMPLETED')),
  ADD COLUMN reservation_id BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
  ADD COLUMN guest_request_id BIGINT REFERENCES guest_requests(id) ON DELETE SET NULL;

CREATE FUNCTION notify_front_office_request_completed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO hk_front_office_notifications
    (room_id, notice_type, message, created_by, guest_request_id)
  VALUES (NEW.room_id, 'REQUEST_COMPLETED', 'Housekeeping completed request REQ-' || NEW.front_office_request_id,
    NEW.staff_id, NEW.front_office_request_id);
  RETURN NEW;
END $$;

CREATE TRIGGER front_office_request_completed_notice
AFTER UPDATE OF request_status ON hk_guest_requests
FOR EACH ROW WHEN (OLD.request_status IS DISTINCT FROM NEW.request_status
  AND NEW.request_status='COMPLETED' AND NEW.front_office_request_id IS NOT NULL)
EXECUTE FUNCTION notify_front_office_request_completed();

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
    GRANT SELECT ON sales_stay_handoffs TO hosis_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON sales_preparation_acknowledgments TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('32-sales-operations-handoffs.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 33-finance-workspace.sql
-- ====================================================================
ALTER TABLE finance_invoices ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(30) NOT NULL DEFAULT 'GUEST'
    CHECK (invoice_type IN ('GUEST','CORPORATE','STAFF'));
ALTER TABLE finance_invoices ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE finance_invoices ADD COLUMN IF NOT EXISTS department VARCHAR(80);
ALTER TABLE finance_invoice_items ADD COLUMN IF NOT EXISTS category VARCHAR(80) DEFAULT 'GENERAL';
ALTER TABLE finance_expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE finance_expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE finance_payroll ADD COLUMN IF NOT EXISTS allowances NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE finance_payroll ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE finance_payroll ADD COLUMN IF NOT EXISTS disbursed_at TIMESTAMPTZ;
ALTER TABLE finance_payroll ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS finance_sales_records (
    id BIGSERIAL PRIMARY KEY,
    deal_code VARCHAR(50) NOT NULL UNIQUE,
    client_name VARCHAR(200) NOT NULL,
    client_email VARCHAR(254),
    client_phone VARCHAR(50),
    package_name VARCHAR(200) NOT NULL,
    package_category VARCHAR(80) NOT NULL DEFAULT 'EVENT_BANQUET',
    contract_amount NUMERIC(12, 2) NOT NULL CHECK (contract_amount >= 0),
    event_date DATE,
    sales_rep VARCHAR(100) DEFAULT 'Sales & Marketing Team',
    status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('LEAD', 'CONFIRMED', 'INVOICED', 'COMPLETED', 'CANCELLED')),
    invoice_id BIGINT REFERENCES finance_invoices(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_sales_records_status ON finance_sales_records (status);
CREATE INDEX IF NOT EXISTS idx_fin_sales_records_client ON finance_sales_records (client_name);
CREATE SEQUENCE IF NOT EXISTS seq_finance_invoice_num START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS seq_finance_expense_num START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS seq_finance_payroll_num START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS seq_finance_txn_num START WITH 1000;

-- Sync sequences with existing row counts if higher
SELECT setval('seq_finance_invoice_num', GREATEST(1000, (SELECT COALESCE(MAX(id), 0) + 1000 FROM finance_invoices)));
SELECT setval('seq_finance_expense_num', GREATEST(1000, (SELECT COALESCE(MAX(id), 0) + 1000 FROM finance_expenses)));
SELECT setval('seq_finance_payroll_num', GREATEST(1000, (SELECT COALESCE(MAX(id), 0) + 1000 FROM finance_payroll)));

-- 2. Performance Indexes on High-Frequency Periodic Filters
CREATE INDEX IF NOT EXISTS idx_fin_invoices_period_status 
    ON finance_invoices (issue_date, status);
CREATE INDEX IF NOT EXISTS idx_fin_invoices_guest_res 
    ON finance_invoices (guest_name, reservation_code);
CREATE INDEX IF NOT EXISTS idx_fin_payments_date_method 
    ON finance_payments (paid_at, payment_method);
CREATE INDEX IF NOT EXISTS idx_fin_expenses_dept_status_date 
    ON finance_expenses (department, status, expense_date);
CREATE INDEX IF NOT EXISTS idx_fin_payroll_dept_status 
    ON finance_payroll (department, status, period_end);

-- 3. Maintenance Work Order & CapEx/OpEx Classification Extensions
ALTER TABLE finance_expenses ADD COLUMN IF NOT EXISTS work_order_id VARCHAR(50);
ALTER TABLE finance_expenses ADD COLUMN IF NOT EXISTS expense_classification VARCHAR(20) DEFAULT 'OPEX';
ALTER TABLE finance_expenses ADD COLUMN IF NOT EXISTS approval_tier VARCHAR(30) DEFAULT 'STANDARD';

ALTER TABLE finance_expenses DROP CONSTRAINT IF EXISTS finance_expenses_classification_check;
ALTER TABLE finance_expenses ADD CONSTRAINT finance_expenses_classification_check 
    CHECK (expense_classification IN ('OPEX', 'CAPEX'));

ALTER TABLE finance_expenses DROP CONSTRAINT IF EXISTS finance_expenses_tier_check;
ALTER TABLE finance_expenses ADD CONSTRAINT finance_expenses_tier_check 
    CHECK (approval_tier IN ('AUTO', 'STANDARD', 'EXECUTIVE_APPROVAL'));

CREATE INDEX IF NOT EXISTS idx_fin_expenses_work_order ON finance_expenses (work_order_id);
CREATE INDEX IF NOT EXISTS idx_fin_expenses_classification ON finance_expenses (expense_classification);

-- 4. Sales & Marketing Milestone Invoicing & Corporate Aging Extensions
ALTER TABLE finance_sales_records ADD COLUMN IF NOT EXISTS milestone_stage VARCHAR(30) DEFAULT 'DEPOSIT_20';
ALTER TABLE finance_sales_records ADD COLUMN IF NOT EXISTS parent_deal_code VARCHAR(50);
ALTER TABLE finance_sales_records ADD COLUMN IF NOT EXISTS payment_term_days INT DEFAULT 30;

ALTER TABLE finance_sales_records DROP CONSTRAINT IF EXISTS finance_sales_milestone_check;
ALTER TABLE finance_sales_records ADD CONSTRAINT finance_sales_milestone_check 
    CHECK (milestone_stage IN ('DEPOSIT_20', 'MIDTERM_50', 'BALANCE_30', 'FULL_PAYMENT'));

-- 5. Housekeeping Inventory Restock & Folio Attachment Extensions

-- 6. Configurable Statutory Rates Table (BIR, SSS, PhilHealth, Pag-IBIG)
CREATE TABLE IF NOT EXISTS finance_statutory_rates (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    rate_type VARCHAR(50) NOT NULL,
    base_percentage NUMERIC(6, 4) DEFAULT 0.0000,
    employee_share NUMERIC(6, 4) DEFAULT 0.0000,
    employer_share NUMERIC(6, 4) DEFAULT 0.0000,
    cap_amount NUMERIC(12, 2) DEFAULT 0.00,
    min_threshold NUMERIC(12, 2) DEFAULT 0.00,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial Philippine statutory rates
INSERT INTO finance_statutory_rates (rule_name, rate_type, base_percentage, employee_share, employer_share, cap_amount, description)
VALUES 
    ('SSS_REGULAR', 'TIERED', 0.1400, 0.0450, 0.0950, 1350.00, 'Social Security System standard monthly bracket contribution'),
    ('PHILHEALTH_STANDARD', 'PERCENTAGE', 0.0500, 0.0250, 0.0250, 2500.00, 'PhilHealth 5% shared equally between employee and employer'),
    ('PAGIBIG_FUND', 'FIXED_OR_TIER', 0.0200, 0.0100, 0.0100, 100.00, 'HDMF Pag-IBIG standard contribution (₱100 employee cap)'),
    ('BIR_TRAIN_LAW_TIER1', 'BRACKET', 0.0000, 0.0000, 0.0000, 20833.00, 'BIR Monthly income below ₱20,833 is 0% tax exempt')
ON CONFLICT (rule_name) DO NOTHING;

-- 7. Automated Night Audit & Day-End Close Table
CREATE TABLE IF NOT EXISTS finance_night_audits (
    id BIGSERIAL PRIMARY KEY,
    audit_date DATE NOT NULL UNIQUE,
    total_room_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_dining_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_services_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_payments_collected NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    occupied_rooms_count INT NOT NULL DEFAULT 0,
    unbalanced_folios_count INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'DISCREPANCY', 'PENDING')),
    audited_by VARCHAR(100) NOT NULL DEFAULT 'System Night Auditor',
    audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_fin_night_audits_date ON finance_night_audits (audit_date DESC);
CREATE SEQUENCE IF NOT EXISTS seq_finance_leave_num START WITH 1000;

CREATE TABLE IF NOT EXISTS finance_leave_requests (
    id BIGSERIAL PRIMARY KEY,
    request_code VARCHAR(50) NOT NULL UNIQUE,
    employee_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    leave_type VARCHAR(60) NOT NULL CHECK (
        leave_type IN (
            'Vacation Leave (VL)',
            'Sick Leave (SL)',
            'Emergency Leave (EL)',
            'Maternity Leave',
            'Paternity Leave',
            'Solo Parent Leave',
            'Bereavement Leave',
            'Study Leave',
            'Unpaid Leave (LWOP)',
            'Special Privilege Leave',
            'Leave Without Notice',
            'Compensatory Time Off (CTO)'
        )
    ),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INT NOT NULL CHECK (total_days > 0),
    reason TEXT NOT NULL,
    contact_info VARCHAR(150),
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    approved_by VARCHAR(100),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sync sequence if needed
SELECT setval('seq_finance_leave_num', GREATEST(1000, (SELECT COALESCE(MAX(id), 0) + 1000 FROM finance_leave_requests)));

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_fin_leave_dept_status ON finance_leave_requests (department, status);
CREATE INDEX IF NOT EXISTS idx_fin_leave_dates ON finance_leave_requests (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_fin_leave_emp ON finance_leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_fin_leave_type ON finance_leave_requests (leave_type);


ALTER TABLE finance_sales_records ADD COLUMN source_sale_id TEXT UNIQUE;
ALTER TABLE finance_sales_records ADD COLUMN shared_invoice_id BIGINT REFERENCES invoices(id);
CREATE TABLE finance_sales_milestones (
  deal_id BIGINT NOT NULL REFERENCES finance_sales_records(id),
  stage VARCHAR(30) NOT NULL,
  invoice_id BIGINT NOT NULL UNIQUE REFERENCES finance_invoices(id),
  PRIMARY KEY (deal_id, stage)
);
ALTER TABLE finance_leave_requests ADD COLUMN submitted_by VARCHAR(80);

CREATE TABLE finance_report_signoffs (
  report_type VARCHAR(60) NOT NULL,
  period VARCHAR(12) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  snapshot JSONB NOT NULL,
  signed_by VARCHAR(100) NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (report_type, period, start_date, end_date)
);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='hosis_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON finance_sales_records,finance_leave_requests,finance_night_audits TO hosis_runtime;
    GRANT SELECT, INSERT ON finance_report_signoffs, finance_sales_milestones TO hosis_runtime;
    GRANT SELECT ON finance_statutory_rates TO hosis_runtime;
    GRANT INSERT, UPDATE ON finance_payroll TO hosis_runtime;
    GRANT USAGE ON SEQUENCE finance_sales_records_id_seq, finance_payroll_id_seq,
      finance_night_audits_id_seq, finance_leave_requests_id_seq,
      seq_finance_invoice_num, seq_finance_expense_num, seq_finance_payroll_num,
      seq_finance_txn_num, seq_finance_leave_num TO hosis_runtime;
  END IF;
END $$;
ALTER TABLE finance_payments DROP CONSTRAINT IF EXISTS finance_payments_payment_method_check;
ALTER TABLE finance_payments ADD CONSTRAINT finance_payments_payment_method_check
  CHECK (payment_method IN ('CASH','CARD','BANK_TRANSFER','OTHER_E_WALLETS','GCASH','MAYA','SALARY_DEDUCTION','CHECK','OTHER'));

INSERT INTO schema_migrations (filename) VALUES ('33-finance-workspace.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 34-finance-department-handoffs.sql
-- ====================================================================
ALTER TABLE finance_expenses
  ADD COLUMN engineering_record_id TEXT,
  ADD COLUMN settlement_reference VARCHAR(120),
  ADD COLUMN settled_at TIMESTAMPTZ,
  ADD COLUMN settled_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX finance_expense_engineering_record_unique
  ON finance_expenses(engineering_record_id) WHERE engineering_record_id IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('34-finance-department-handoffs.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 35-hr-recruitment.sql
-- ====================================================================
CREATE TABLE IF NOT EXISTS hr_job_vacancies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  dept TEXT NOT NULL CHECK (dept IN ('frontdesk', 'housekeeping', 'finance', 'maintenance')),
  openings INTEGER NOT NULL CHECK (openings > 0),
  posted DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Open', 'Closed', 'On Hold')),
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS hr_applicants (
  id TEXT PRIMARY KEY,
  vacancy_id TEXT NOT NULL REFERENCES hr_job_vacancies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  position TEXT NOT NULL,
  application_date DATE NOT NULL,
  status TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  resume TEXT NOT NULL DEFAULT '',
  interview_date DATE,
  interview_result TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT 'HR Admin',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  education TEXT NOT NULL DEFAULT '',
  experience TEXT NOT NULL DEFAULT ''
);


ALTER TABLE hr_applicants ADD CONSTRAINT hr_applicants_status_check
  CHECK (status IN ('Pending','Under Review','Interview','Approved','Rejected','Hired'));
ALTER TABLE hr_employees ADD COLUMN recruitment_id TEXT UNIQUE REFERENCES hr_applicants(id);
CREATE INDEX hr_applicants_vacancy_idx ON hr_applicants(vacancy_id);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='hosis_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON hr_job_vacancies, hr_applicants TO hosis_runtime;
    GRANT INSERT, DELETE ON hr_employees TO hosis_runtime;
    GRANT UPDATE (name,pos,dept,status,contact,hired,today,time_in,days,late,absences,overtime) ON hr_employees TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('35-hr-recruitment.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 36-hr-department-handoffs.sql
-- ====================================================================
CREATE TABLE hr_staffing_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  department TEXT NOT NULL CHECK (department IN ('frontdesk','housekeeping','finance','maintenance','sales','hr')),
  needed_on DATE NOT NULL,
  staff_needed INTEGER NOT NULL CHECK (staff_needed BETWEEN 1 AND 50),
  details VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Declined')),
  requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note VARCHAR(500)
);

ALTER TABLE hr_job_vacancies DROP CONSTRAINT hr_job_vacancies_dept_check;
ALTER TABLE hr_job_vacancies ADD CONSTRAINT hr_job_vacancies_dept_check
  CHECK (dept IN ('frontdesk','housekeeping','finance','maintenance','sales','hr'));

CREATE INDEX hr_staffing_department_date_idx ON hr_staffing_requests(department, needed_on);
CREATE INDEX hr_employees_department_idx ON hr_employees(dept);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname='hosis_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON hr_staffing_requests TO hosis_runtime;
    GRANT USAGE ON SEQUENCE hr_staffing_requests_id_seq TO hosis_runtime;
    GRANT UPDATE (staff_user_id) ON hr_employees TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('36-hr-department-handoffs.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 37-engineering-leave-and-report-archives.sql
-- ====================================================================
CREATE TABLE IF NOT EXISTS engineering.engineering_leave_records (
    id BIGSERIAL PRIMARY KEY,
    operation_id UUID NOT NULL UNIQUE,
    hr_leave_id TEXT UNIQUE REFERENCES hr_leave_requests(id) ON DELETE SET NULL,
    employee_id BIGINT NOT NULL REFERENCES public.users(id),
    employee_name TEXT NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN (
        'Vacation Leave (VL)',
        'Sick Leave (SL)',
        'Emergency Leave (EL)',
        'Maternity Leave',
        'Paternity Leave',
        'Solo Parent Leave',
        'Bereavement Leave',
        'Study Leave',
        'Unpaid Leave (LWOP)',
        'Special Privilege Leave',
        'Leave Without Notice',
        'Compensatory Time Off (CTO)'
    )),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 5000),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN (
        'Pending', 'Approved', 'Rejected', 'Cancelled'
    )),
    created_by BIGINT NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by BIGINT REFERENCES public.users(id),
    reviewed_by_name TEXT,
    reviewed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS engineering_leave_employee_idx
    ON engineering.engineering_leave_records (employee_id, start_date DESC);
CREATE INDEX IF NOT EXISTS engineering_leave_status_type_idx
    ON engineering.engineering_leave_records (status, leave_type, start_date DESC);

CREATE TABLE IF NOT EXISTS engineering.engineering_report_archives (
    id BIGSERIAL PRIMARY KEY,
    period_type TEXT NOT NULL CHECK (period_type IN (
        'daily', 'weekly', 'monthly', 'annual'
    )),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('csv', 'xlsx')),
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    content BYTEA NOT NULL,
    checksum TEXT NOT NULL,
    row_count INTEGER NOT NULL CHECK (row_count >= 0),
    generated_by BIGINT NOT NULL REFERENCES public.users(id),
    generated_by_name TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (period_start <= period_end),
    UNIQUE (period_type, period_start, period_end, format)
);

CREATE INDEX IF NOT EXISTS engineering_report_archive_generated_idx
    ON engineering.engineering_report_archives (generated_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON
      engineering.engineering_leave_records,
      engineering.engineering_report_archives
    TO hosis_runtime;
    GRANT USAGE ON SEQUENCE
      engineering.engineering_leave_records_id_seq,
      engineering.engineering_report_archives_id_seq
    TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('37-engineering-leave-and-report-archives.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 38-report-and-pay-periods.sql
-- ====================================================================
CREATE TABLE IF NOT EXISTS hr_attendance_periods (
    employee_id TEXT NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    days_worked INTEGER NOT NULL CHECK (days_worked >= 0),
    overtime_hours INTEGER NOT NULL CHECK (overtime_hours >= 0),
    daily_rate NUMERIC NOT NULL,
    PRIMARY KEY (employee_id, period_start, period_end),
    CHECK (period_start <= period_end)
);

DO $$
DECLARE previous_constraint text;
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
        GRANT SELECT, INSERT, UPDATE ON hr_attendance_periods TO hosis_runtime;
    END IF;

    SELECT conname INTO previous_constraint FROM pg_constraint
    WHERE conrelid = 'engineering.engineering_report_archives'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (period_type, period_start, period_end, format)';
    IF previous_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE engineering.engineering_report_archives DROP CONSTRAINT %I', previous_constraint);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS engineering_report_archives_content_idx
    ON engineering.engineering_report_archives (period_type, period_start, period_end, format, checksum);

INSERT INTO schema_migrations (filename) VALUES ('38-report-and-pay-periods.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 39-audit-payroll-and-folios.sql
-- ====================================================================
ALTER TABLE finance_invoices ADD COLUMN IF NOT EXISTS reservation_id BIGINT REFERENCES reservations(id);
UPDATE finance_invoices i SET reservation_id=r.id FROM reservations r
WHERE i.reservation_id IS NULL AND i.reservation_code=r.confirmation_code;
CREATE INDEX IF NOT EXISTS finance_invoices_reservation_id_idx ON finance_invoices (reservation_id);

ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS submitted_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS finance_payroll_employee_period_idx
    ON finance_payroll (lower(btrim(employee_id)), period_start, period_end);

CREATE OR REPLACE FUNCTION prevent_duplicate_finance_payroll() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('payroll:' || lower(btrim(NEW.employee_id)), 0));
    IF EXISTS (
        SELECT FROM finance_payroll p
        WHERE lower(btrim(p.employee_id))=lower(btrim(NEW.employee_id)) AND p.period_start=NEW.period_start
          AND p.period_end=NEW.period_end AND p.id IS DISTINCT FROM NEW.id
    ) THEN
        RAISE EXCEPTION 'Payroll already exists for this employee and period.'
          USING ERRCODE='23505';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER finance_payroll_unique_period BEFORE INSERT OR UPDATE OF employee_id, period_start, period_end
ON finance_payroll FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_finance_payroll();

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='hosis_runtime') THEN
        GRANT UPDATE (rate) ON hr_employees TO hosis_runtime;
        GRANT SELECT, INSERT ON front_office_activity TO hosis_runtime;
        GRANT USAGE ON SEQUENCE front_office_activity_id_seq TO hosis_runtime;
    END IF;
END $$;

CREATE OR REPLACE VIEW admin_activity_events AS
SELECT 'desk-' || a.id AS id,
       CASE WHEN a.action LIKE 'ADMIN_%' THEN 'Administration'
            WHEN a.action LIKE 'HOUSEKEEPING_%' THEN 'Housekeeping'
            WHEN a.action LIKE 'HR_%' THEN 'Human Resources'
            WHEN a.action LIKE 'SALES_%' THEN 'Sales & Marketing' ELSE 'Front Office' END AS module,
       a.action, a.description, u.username AS actor, a.created_at
FROM front_office_activity a LEFT JOIN users u ON u.id=a.user_id
UNION ALL
SELECT 'finding-' || e.event_id, 'Housekeeping', e.action,
       CONCAT_WS(': ',f.public_reference,e.notes), u.username, e.created_at
FROM hk_charge_finding_events e
JOIN hk_charge_findings f ON f.finding_id=e.finding_id LEFT JOIN users u ON u.id=e.actor_id
UNION ALL
SELECT 'finance-' || id,'Finance',activity, CONCAT_WS(' / ',transaction_code,reference_code,amount_label),user_name,created_at
FROM finance_audit_log
UNION ALL
SELECT 'engineering-' || id,'Engineering',action,CONCAT_WS(' / ',collection,record_id),actor_name,created_at
FROM engineering.engineering_audit
UNION ALL
SELECT 'hr-assignment-' || id,'Human Resources','ASSIGNMENT_CHANGED',
       CONCAT_WS(' / ',emp,from_value || ' -> ' || to_value,note),by_user,COALESCE(recorded_at,date::timestamptz)
FROM hr_assignment_logs
UNION ALL
SELECT 'hr-leave-' || l.id,'Human Resources','LEAVE_SUBMITTED',
       CONCAT_WS(' / ',l.id,l.emp,l.type),u.username,l.submitted_at
FROM hr_leave_requests l JOIN hr_employees e ON e.id=l.emp LEFT JOIN users u ON u.id=l.submitted_by
UNION ALL
SELECT 'hr-leave-decision-' || l.id,'Human Resources','LEAVE_' || UPPER(l.status),
       CONCAT_WS(' / ',l.id,l.emp,l.decision_notes),u.username,l.decided_at
FROM hr_leave_requests l LEFT JOIN users u ON u.id=l.decided_by WHERE l.decided_at IS NOT NULL;

INSERT INTO schema_migrations (filename) VALUES ('39-audit-payroll-and-folios.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 40-staff-account-deletion.sql
-- ====================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE users ADD CONSTRAINT users_deleted_accounts_inactive
  CHECK (deleted_at IS NULL OR NOT is_active);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
    GRANT SELECT (deleted_at), UPDATE (deleted_at) ON users TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('40-staff-account-deletion.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 41-account-login-lock.sql
-- ====================================================================
ALTER TABLE users
  ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0 CHECK (failed_logins BETWEEN 0 AND 5),
  ADD COLUMN login_locked_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'hosis_runtime') THEN
    GRANT SELECT (failed_logins, login_locked_at), UPDATE (failed_logins, login_locked_at) ON users TO hosis_runtime;
  END IF;
END $$;

INSERT INTO schema_migrations (filename) VALUES ('41-account-login-lock.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- Migration: 42-finance-subsystem-integration.sql
-- ====================================================================
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

INSERT INTO schema_migrations (filename) VALUES ('42-finance-subsystem-integration.sql') ON CONFLICT (filename) DO NOTHING;

-- ====================================================================
-- BASELINE SEED DATA FOR NEW HOSTING ENVIRONMENT
-- ====================================================================

-- 1. Default Hotel Staff Accounts
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('admin', '$2b$10$LcvFnJxM4Xwf5nNh1tvT3Ohq8MWLE9HCrlt9ZWchkFwi/p2JhYKIi', 'ADMIN', 'SUPERVISOR', 'System', 'Administrator', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('superadmin', '$2b$10$c2VMrr5R282DXPxbDzIuqOCjKvzqtBpmr6Qz2uiAX/zQCQ1DwaF5e', 'SUPER_ADMIN', 'SUPERVISOR', 'Super', 'Admin', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('frontoffice', '$2b$10$qv5O9ocMsC44ToHdXKZy.ec6C3ym1u6O0ubLbl6jgTFH1drb0ikPC', 'FRONT_OFFICE', 'SUPERVISOR', 'Front', 'Office', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('frontdesk', '$2b$10$K5yfxt1InrdN520HD7NpEuYqul3eDBtcsOHrez55QdMMrNjOsq9Aq', 'FRONT_OFFICE', 'SUPERVISOR', 'Front', 'Desk', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('finance.officer', '$2b$10$ZNGSP9uL46.EXENtMAd4v.utcTPMqJtxgxA1szLZ.o5gfXgmtK2OK', 'FINANCE', 'SUPERVISOR', 'Elena', 'Ramos', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('finofficer', '$2b$10$b1ZlqUfTMyR7OMaweUhcuuICU/BetysM0D2726sq5Pcvo3Rx7Ho0m', 'FINANCE', 'SUPERVISOR', 'Elena', 'Ramos', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('officer', '$2b$10$oDv/iI89bN5QSohDyvsiDO/CMKj3LQg2RB0.KxFsxopqIypeVlqQ2', 'OFFICER', 'SUPERVISOR', 'Finance', 'Officer', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('finance.head', '$2b$10$PsUgj/or9Vr0flEdpw1Zz.KhtAPFoGRLlho1eh.3Jg2m8ozsFrqwe', 'DEPARTMENT_HEAD', 'SUPERVISOR', 'Danielle', 'Villanueva', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('finhead', '$2b$10$8HlJY6cpGix0sCbVCwxMOeVKtGgemG9fOXX0su2F/XoCVs5LUegsy', 'DEPARTMENT_HEAD', 'SUPERVISOR', 'Danielle', 'Villanueva', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('head', '$2b$10$/DHXX7TuBF2Nn0w9Yx/DMO2.3axVdEnosHsJgGpXqERJpv7nzVxCe', 'HEAD', 'SUPERVISOR', 'Department', 'Head', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('financehead', '$2b$10$v1fbPqw6OsQRviirfPJHouVjhZcKjpQO1ZaOm7YWW5QGWbkZsoJpm', 'DEPARTMENT_HEAD', 'SUPERVISOR', 'Finance', 'Head', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('sales.agent', '$2b$10$zRf6lcS4Fx3swKvjx0eceuU2WPWZMmNERu3PJmhuc6gk7U1y8uzyW', 'SALES_MARKETING', 'SALES_STAFF', 'Camille', 'Ocampo', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('sales.manager', '$2b$10$yRQNnm4wFbG6nbpuxo8G4.MpIy47YTaoGjiZOHzrTvUnpOZysT3qa', 'SALES_MARKETING', 'SALES_HEAD', 'Marco', 'Cruz', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('hr', '$2b$10$ulAQVzin81Su66kcfpm4NuMMIyIJV7jTPAI5fOfERA6ub6vbicMey', 'HR', 'SUPERVISOR', 'Human', 'Resources', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('engineer', '$2b$10$nVjTwf5LqncOgkEjmSeDoulmIZKAO5Eo4vNefhRD2LwfehGPa6QbO', 'ENGINEERING', 'SUPERVISOR', 'Chief', 'Engineer', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('technician', '$2b$10$ymoCJ7JcbgJ6ScE9APbMuu18DpIcXjzU1qlPITEHM4QmIN5EHBj3q', 'TECHNICIAN', 'TECHNICIAN', 'Lead', 'Technician', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('housekeeper', '$2b$10$QUqRZUvgMhQ6w3neu4j/KewH1G378zr42MNicccVukWaAVAtGuJyu', 'HOUSEKEEPING', 'HOUSEKEEPER', 'Maria', 'Santos', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;
INSERT INTO users (username, password_hash, role, position, first_name, last_name, is_active)
VALUES ('inspector', '$2b$10$fudPGfCj52q/qePzKMm89OGJK/8E2dMh3fZMlANOVDPhdBywxqFBe', 'HOUSEKEEPING', 'INSPECTOR', 'Roberto', 'Diaz', TRUE)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  position = EXCLUDED.position,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  is_active = TRUE;

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
