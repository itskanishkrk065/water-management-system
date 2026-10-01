export const CREATE_TABLES_SQL = `
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'FIELD_OFFICER')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Location hierarchy (LGD)
CREATE TABLE IF NOT EXISTS districts (
  district_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT
);

CREATE TABLE IF NOT EXISTS blocks (
  block_id TEXT PRIMARY KEY,
  district_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  FOREIGN KEY (district_id) REFERENCES districts (district_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS villages (
  village_id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  FOREIGN KEY (block_id) REFERENCES blocks (block_id) ON DELETE CASCADE
);

-- Projects & Tariffs
CREATE TABLE IF NOT EXISTS project_schemes (
  project_id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  project_code TEXT UNIQUE NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rate_tariffs (
  rate_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  litres_per_acre REAL NOT NULL,
  development_cost_per_litre REAL NOT NULL,
  running_cost_per_litre REAL NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (project_id) REFERENCES project_schemes (project_id)
);

-- Beneficiaries
CREATE TABLE IF NOT EXISTS beneficiaries (
  beneficiary_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  address_line3 TEXT,
  district_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  village_id TEXT NOT NULL,
  pincode TEXT NOT NULL,
  location_direction TEXT,
  location_description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  total_land_acres REAL NOT NULL DEFAULT 0.0,
  sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  last_synced_at TEXT,
  local_version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (district_id) REFERENCES districts (district_id),
  FOREIGN KEY (block_id) REFERENCES blocks (block_id),
  FOREIGN KEY (village_id) REFERENCES villages (village_id)
);

-- Land Holdings
CREATE TABLE IF NOT EXISTS land_holdings (
  holding_id TEXT PRIMARY KEY,
  beneficiary_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  declared_total_area REAL NOT NULL,
  area_unit TEXT NOT NULL DEFAULT 'acres',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  is_locked INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  last_synced_at TEXT,
  local_version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (beneficiary_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES project_schemes (project_id)
);

-- Survey / Subdivision Parcels (Composite unique constraint on holding + survey_number + subdivision_number)
CREATE TABLE IF NOT EXISTS survey_parcels (
  parcel_id TEXT PRIMARY KEY,
  holding_id TEXT NOT NULL,
  survey_number TEXT NOT NULL,
  subdivision_number TEXT NOT NULL,
  area REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  last_synced_at TEXT,
  local_version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (holding_id) REFERENCES land_holdings (holding_id) ON DELETE CASCADE,
  UNIQUE(holding_id, survey_number, subdivision_number)
);

-- Water Applications
CREATE TABLE IF NOT EXISTS water_applications (
  application_id TEXT PRIMARY KEY,
  beneficiary_id TEXT NOT NULL,
  holding_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  rate_id_snapshot TEXT NOT NULL,
  required_litres REAL NOT NULL,
  calculated_litres REAL NOT NULL,
  litres_per_acre_snapshot REAL NOT NULL,
  development_cost_per_litre_snapshot REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'VOIDED')),
  application_date TEXT NOT NULL DEFAULT (datetime('now')),
  remarks TEXT,
  sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  last_synced_at TEXT,
  local_version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (beneficiary_id) ON DELETE CASCADE,
  FOREIGN KEY (holding_id) REFERENCES land_holdings (holding_id),
  FOREIGN KEY (project_id) REFERENCES project_schemes (project_id)
);

-- Water Allotments
CREATE TABLE IF NOT EXISTS water_allotments (
  allotment_id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL UNIQUE,
  beneficiary_id TEXT NOT NULL,
  holding_id TEXT NOT NULL,
  approved_litres REAL NOT NULL,
  approved_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_by TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  last_synced_at TEXT,
  local_version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (application_id) REFERENCES water_applications (application_id) ON DELETE CASCADE,
  FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (beneficiary_id),
  FOREIGN KEY (holding_id) REFERENCES land_holdings (holding_id)
);

-- Development Bills
CREATE TABLE IF NOT EXISTS development_bills (
  bill_id TEXT PRIMARY KEY,
  beneficiary_id TEXT NOT NULL,
  allotment_id TEXT NOT NULL UNIQUE,
  approved_litres_snapshot REAL NOT NULL,
  development_cost_per_litre_snapshot REAL NOT NULL,
  total_amount REAL NOT NULL,
  amount_paid REAL NOT NULL DEFAULT 0.0,
  pending_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
  sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  last_synced_at TEXT,
  local_version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (beneficiary_id),
  FOREIGN KEY (allotment_id) REFERENCES water_allotments (allotment_id)
);

-- Installments (2.5%, 20%, 25%, 25%, 27.5%)
CREATE TABLE IF NOT EXISTS installments (
  installment_id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  installment_number INTEGER NOT NULL CHECK (installment_number BETWEEN 1 AND 5),
  percentage REAL NOT NULL,
  amount_due REAL NOT NULL,
  amount_paid REAL NOT NULL DEFAULT 0.0,
  pending_amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')),
  milestone_name TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  last_synced_at TEXT,
  local_version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (bill_id) REFERENCES development_bills (bill_id) ON DELETE CASCADE
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  installment_id TEXT,
  beneficiary_id TEXT NOT NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('CASH', 'CHEQUE', 'NEFT', 'RTGS', 'UPI', 'OFFLINE')),
  payment_reference TEXT,
  payment_date TEXT NOT NULL DEFAULT (datetime('now')),
  is_reversal INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
  last_synced_at TEXT,
  local_version INTEGER NOT NULL DEFAULT 1,
  server_version INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (bill_id) REFERENCES development_bills (bill_id),
  FOREIGN KEY (installment_id) REFERENCES installments (installment_id),
  FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries (beneficiary_id)
);

-- Progressive Registration Drafts
CREATE TABLE IF NOT EXISTS local_drafts (
  draft_id TEXT PRIMARY KEY,
  step INTEGER NOT NULL DEFAULT 1,
  phone_number TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  district_id TEXT,
  block_id TEXT,
  village_id TEXT,
  pincode TEXT,
  holdings_json TEXT NOT NULL DEFAULT '[]',
  water_required_litres REAL,
  project_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sync Queue
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  operation_id TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('CREATE', 'UPDATE', 'DELETE')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'FAILED', 'CONFLICT', 'COMPLETED')),
  last_error TEXT,
  last_attempt_at TEXT
);

-- Local Audit Logs
CREATE TABLE IF NOT EXISTS local_audit_logs (
  audit_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL,
  device_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details_json TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'LOCAL_ONLY'
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_beneficiaries_phone ON beneficiaries (phone_number);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_name ON beneficiaries (name);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_village ON beneficiaries (village_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_sync ON beneficiaries (sync_status);

CREATE INDEX IF NOT EXISTS idx_holdings_beneficiary ON land_holdings (beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_parcels_holding ON survey_parcels (holding_id);
CREATE INDEX IF NOT EXISTS idx_parcels_survey ON survey_parcels (survey_number, subdivision_number);

CREATE INDEX IF NOT EXISTS idx_water_apps_beneficiary ON water_applications (beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_water_apps_holding ON water_applications (holding_id);
CREATE INDEX IF NOT EXISTS idx_water_apps_status ON water_applications (status);

CREATE INDEX IF NOT EXISTS idx_allotments_holding ON water_allotments (holding_id);
CREATE INDEX IF NOT EXISTS idx_bills_beneficiary ON development_bills (beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_installments_bill ON installments (bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments (bill_id);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON local_audit_logs (entity_type, entity_id);
`;
