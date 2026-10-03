-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'FIELD_OFFICER', 'ACCOUNTS', 'VIEWER', 'BENEFICIARY');

-- CreateEnum
CREATE TYPE "LocationDirection" AS ENUM ('NORTH', 'SOUTH', 'EAST', 'WEST');

-- CreateEnum
CREATE TYPE "BeneficiaryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LandStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'SUSPENDED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'DD', 'ONLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'REVERSED');

-- CreateEnum
CREATE TYPE "InfrastructureStatus" AS ENUM ('PLANNED', 'UNDER_CONSTRUCTION', 'COMPLETED', 'COMMISSIONED');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE_VOID', 'SUBMIT', 'APPROVE', 'REJECT', 'PARTIALLY_APPROVE', 'PAYMENT_RECORDED', 'PAYMENT_REVERSED', 'RATE_CHANGED', 'INSTALLMENT_SCHEDULE_CHANGED', 'INFRASTRUCTURE_STATUS_CHANGED', 'EXTENSION_APPROVED', 'USAGE_RECORDED', 'USAGE_UPDATED', 'USAGE_VERIFIED', 'USAGE_CORRECTED', 'USAGE_VOIDED', 'RUNNING_BILL_CREATED', 'RUNNING_BILL_VOIDED', 'RUNNING_PAYMENT_RECORDED', 'RUNNING_PAYMENT_REVERSED', 'TARIFF_RESOLVED', 'COMMISSIONING_CHANGED', 'RUNNING_START_DATE_CHANGED', 'SYSTEM_CLOCK_ROLLBACK');

-- CreateEnum
CREATE TYPE "BillingPeriodStatus" AS ENUM ('UPCOMING', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "UsageEntryMode" AS ENUM ('DIRECT', 'METER_READING');

-- CreateEnum
CREATE TYPE "WaterUsageStatus" AS ENUM ('DRAFT', 'RECORDED', 'SUBMITTED', 'VERIFIED', 'BILLED', 'VOIDED', 'OVER_ALLOCATION', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "LocationImportStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'VALIDATED', 'IMPORTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('LAND_RECORD', 'WATER_APPLICATION', 'APPROVAL_LETTER', 'PAYMENT_RECEIPT', 'INFRASTRUCTURE_REPORT', 'EXTENSION_REQUEST', 'OTHER');

-- CreateTable
CREATE TABLE "roles" (
    "role_id" UUID NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "token_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("token_id")
);

-- CreateTable
CREATE TABLE "projects" (
    "project_id" UUID NOT NULL,
    "project_code" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "districts" (
    "district_id" UUID NOT NULL,
    "lgd_district_code" INTEGER,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("district_id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "block_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "lgd_block_code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("block_id")
);

-- CreateTable
CREATE TABLE "panchayats" (
    "panchayat_id" UUID NOT NULL,
    "district_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "panchayats_pkey" PRIMARY KEY ("panchayat_id")
);

-- CreateTable
CREATE TABLE "villages" (
    "village_id" UUID NOT NULL,
    "block_id" UUID,
    "panchayat_id" UUID,
    "lgd_village_code" INTEGER,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "villages_pkey" PRIMARY KEY ("village_id")
);

-- CreateTable
CREATE TABLE "location_imports" (
    "import_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_rows" INTEGER NOT NULL,
    "valid_rows" INTEGER NOT NULL,
    "invalid_rows" INTEGER NOT NULL,
    "districts_created" INTEGER NOT NULL DEFAULT 0,
    "districts_updated" INTEGER NOT NULL DEFAULT 0,
    "blocks_created" INTEGER NOT NULL DEFAULT 0,
    "blocks_updated" INTEGER NOT NULL DEFAULT 0,
    "villages_created" INTEGER NOT NULL DEFAULT 0,
    "villages_updated" INTEGER NOT NULL DEFAULT 0,
    "status" "LocationImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "error_summary" JSONB,
    "preview_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_imports_pkey" PRIMARY KEY ("import_id")
);

-- CreateTable
CREATE TABLE "beneficiaries" (
    "beneficiary_id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone_number" TEXT NOT NULL,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "address_line_3" TEXT,
    "district_id" UUID,
    "block_id" UUID,
    "panchayat_id" UUID,
    "village_id" UUID,
    "pincode" TEXT,
    "location_direction" "LocationDirection",
    "location_description" TEXT,
    "status" "BeneficiaryStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("beneficiary_id")
);

-- CreateTable
CREATE TABLE "land_holdings" (
    "land_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "declared_total_area" DECIMAL(12,4) NOT NULL,
    "area_unit" TEXT NOT NULL DEFAULT 'ACRES',
    "status" "LandStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "land_holdings_pkey" PRIMARY KEY ("land_id")
);

-- CreateTable
CREATE TABLE "land_parcels" (
    "parcel_id" UUID NOT NULL,
    "land_id" UUID NOT NULL,
    "survey_number" TEXT NOT NULL,
    "subdivision_number" TEXT NOT NULL,
    "area" DECIMAL(12,4) NOT NULL,
    "area_unit" TEXT NOT NULL DEFAULT 'ACRES',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "land_parcels_pkey" PRIMARY KEY ("parcel_id")
);

-- CreateTable
CREATE TABLE "rate_configurations" (
    "rate_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "rate_type" TEXT NOT NULL DEFAULT 'STANDARD',
    "version_code" TEXT,
    "litres_per_acre" DECIMAL(14,2) NOT NULL,
    "development_cost_per_litre" DECIMAL(10,4) NOT NULL,
    "running_cost_per_litre" DECIMAL(10,4) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_configurations_pkey" PRIMARY KEY ("rate_id")
);

-- CreateTable
CREATE TABLE "installment_templates" (
    "template_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "inst_1_pct" DECIMAL(5,2) NOT NULL DEFAULT 2.50,
    "inst_2_pct" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    "inst_3_pct" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    "inst_4_pct" DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    "inst_5_pct" DECIMAL(5,2) NOT NULL DEFAULT 27.50,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installment_templates_pkey" PRIMARY KEY ("template_id")
);

-- CreateTable
CREATE TABLE "water_applications" (
    "application_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "land_id" UUID,
    "required_litres" DECIMAL(14,2) NOT NULL,
    "application_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "water_applications_pkey" PRIMARY KEY ("application_id")
);

-- CreateTable
CREATE TABLE "water_allotments" (
    "allotment_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "rate_id" UUID NOT NULL,
    "total_land_acres_snapshot" DECIMAL(12,4) NOT NULL,
    "litres_per_acre_snapshot" DECIMAL(14,2) NOT NULL,
    "calculated_allotted_litres" DECIMAL(14,2) NOT NULL,
    "approved_litres" DECIMAL(14,2) NOT NULL,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "approved_by" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approval_remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "water_allotments_pkey" PRIMARY KEY ("allotment_id")
);

-- CreateTable
CREATE TABLE "development_bills" (
    "bill_id" UUID NOT NULL,
    "allotment_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "approved_litres_snapshot" DECIMAL(14,2) NOT NULL,
    "development_cost_per_litre_snapshot" DECIMAL(18,4) NOT NULL,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pending_amount" DECIMAL(18,2) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "development_bills_pkey" PRIMARY KEY ("bill_id")
);

-- CreateTable
CREATE TABLE "installments" (
    "installment_id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "amount_due" DECIMAL(18,2) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pending_amount" DECIMAL(18,2) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("installment_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "installment_id" UUID,
    "running_bill_id" UUID,
    "extension_id" UUID,
    "amount" DECIMAL(18,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_reference" TEXT,
    "receipt_number" TEXT NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "is_reversal" BOOLEAN NOT NULL DEFAULT false,
    "reversal_payment_id" UUID,
    "remarks" TEXT,
    "recorded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "infrastructure" (
    "infrastructure_id" UUID NOT NULL,
    "allotment_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "status" "InfrastructureStatus" NOT NULL DEFAULT 'PLANNED',
    "planned_date" TIMESTAMP(3),
    "construction_start_date" TIMESTAMP(3),
    "completion_date" TIMESTAMP(3),
    "commissioned_date" TIMESTAMP(3),
    "running_charge_start_date" TIMESTAMP(3),
    "remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "infrastructure_pkey" PRIMARY KEY ("infrastructure_id")
);

-- CreateTable
CREATE TABLE "billing_periods" (
    "billing_period_id" TEXT NOT NULL,
    "period_code" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "status" "BillingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "collection_start_date" TIMESTAMP(3) NOT NULL,
    "collection_end_date" TIMESTAMP(3) NOT NULL,
    "payment_due_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("billing_period_id")
);

-- CreateTable
CREATE TABLE "water_usage_records" (
    "usage_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "allotment_id" UUID NOT NULL,
    "infrastructure_id" UUID,
    "billing_period_id" TEXT NOT NULL,
    "collection_agent_id" UUID,
    "usage_period_start" TIMESTAMP(3) NOT NULL,
    "usage_period_end" TIMESTAMP(3) NOT NULL,
    "collection_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actual_usage_litres" DECIMAL(14,2) NOT NULL,
    "approved_litres_snapshot" DECIMAL(14,2) NOT NULL,
    "usage_entry_mode" "UsageEntryMode" NOT NULL DEFAULT 'DIRECT',
    "previous_meter_reading" DECIMAL(16,2),
    "current_meter_reading" DECIMAL(16,2),
    "running_rate_snapshot" DECIMAL(18,4) NOT NULL,
    "tariff_id" UUID,
    "tariff_version" TEXT,
    "calculated_amount" DECIMAL(18,2) NOT NULL,
    "status" "WaterUsageStatus" NOT NULL DEFAULT 'RECORDED',
    "notes" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "water_usage_records_pkey" PRIMARY KEY ("usage_id")
);

-- CreateTable
CREATE TABLE "running_bills" (
    "running_bill_id" UUID NOT NULL,
    "bill_number" TEXT,
    "allotment_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "rate_id" UUID NOT NULL,
    "billing_period" TEXT NOT NULL,
    "billing_period_id" TEXT,
    "usage_id" UUID,
    "billing_period_start" TIMESTAMP(3),
    "billing_period_end" TIMESTAMP(3),
    "running_charge_start_date_snapshot" TIMESTAMP(3),
    "commissioned_date_snapshot" TIMESTAMP(3),
    "tariff_version" TEXT,
    "calculation_breakdown" TEXT,
    "approved_litres_snapshot" DECIMAL(14,2) NOT NULL,
    "actual_usage_litres_snapshot" DECIMAL(14,2),
    "running_cost_per_litre_snapshot" DECIMAL(18,4) NOT NULL,
    "amount_due" DECIMAL(18,2) NOT NULL,
    "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pending_amount" DECIMAL(18,2) NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "is_legacy" BOOLEAN NOT NULL DEFAULT false,
    "legacy_classification" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "running_bills_pkey" PRIMARY KEY ("running_bill_id")
);

-- CreateTable
CREATE TABLE "system_clock_state" (
    "state_id" TEXT NOT NULL,
    "last_known_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_rollback_detected" BOOLEAN NOT NULL DEFAULT false,
    "rollback_detected_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_clock_state_pkey" PRIMARY KEY ("state_id")
);

-- CreateTable
CREATE TABLE "extensions" (
    "extension_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "original_allotment_id" UUID NOT NULL,
    "requested_additional_area" DECIMAL(12,4) NOT NULL,
    "requested_additional_litres" DECIMAL(14,2) NOT NULL,
    "approved_additional_area" DECIMAL(12,4),
    "approved_additional_litres" DECIMAL(14,2),
    "rate_id" UUID,
    "additional_development_cost_per_litre" DECIMAL(18,4),
    "extension_cost" DECIMAL(18,2),
    "status" "ExtensionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extensions_pkey" PRIMARY KEY ("extension_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "audit_id" UUID NOT NULL,
    "user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "reason" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "beneficiary_documents" (
    "document_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "mime_type" TEXT,
    "storage_path" TEXT NOT NULL,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficiary_documents_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "report_presets" (
    "preset_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "filters_json" TEXT NOT NULL,
    "columns_json" TEXT,
    "sort_by" TEXT,
    "sort_order" TEXT NOT NULL DEFAULT 'asc',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_presets_pkey" PRIMARY KEY ("preset_id")
);

-- CreateTable
CREATE TABLE "sync_operations" (
    "operation_id" UUID NOT NULL,
    "client_op_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("operation_id")
);

-- CreateTable
CREATE TABLE "server_change_feed" (
    "feed_id" BIGSERIAL NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "origin_device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_change_feed_pkey" PRIMARY KEY ("feed_id")
);

-- CreateTable
CREATE TABLE "device_registrations" (
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "app_version" TEXT NOT NULL,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sync_at" TIMESTAMP(3),
    "last_ack_feed_id" BIGINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "device_registrations_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "beneficiary_advance_ledger" (
    "advance_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "consumed_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficiary_advance_ledger_pkey" PRIMARY KEY ("advance_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_project_code_key" ON "projects"("project_code");

-- CreateIndex
CREATE UNIQUE INDEX "districts_lgd_district_code_key" ON "districts"("lgd_district_code");

-- CreateIndex
CREATE INDEX "districts_lgd_district_code_idx" ON "districts"("lgd_district_code");

-- CreateIndex
CREATE INDEX "districts_name_idx" ON "districts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_lgd_block_code_key" ON "blocks"("lgd_block_code");

-- CreateIndex
CREATE INDEX "blocks_district_id_idx" ON "blocks"("district_id");

-- CreateIndex
CREATE INDEX "blocks_lgd_block_code_idx" ON "blocks"("lgd_block_code");

-- CreateIndex
CREATE INDEX "blocks_district_id_lgd_block_code_idx" ON "blocks"("district_id", "lgd_block_code");

-- CreateIndex
CREATE UNIQUE INDEX "panchayats_district_id_name_key" ON "panchayats"("district_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "villages_lgd_village_code_key" ON "villages"("lgd_village_code");

-- CreateIndex
CREATE INDEX "villages_block_id_idx" ON "villages"("block_id");

-- CreateIndex
CREATE INDEX "villages_panchayat_id_idx" ON "villages"("panchayat_id");

-- CreateIndex
CREATE INDEX "villages_lgd_village_code_idx" ON "villages"("lgd_village_code");

-- CreateIndex
CREATE INDEX "villages_name_idx" ON "villages"("name");

-- CreateIndex
CREATE INDEX "location_imports_uploaded_at_idx" ON "location_imports"("uploaded_at");

-- CreateIndex
CREATE INDEX "location_imports_status_idx" ON "location_imports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "beneficiaries_user_id_key" ON "beneficiaries"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "beneficiaries_phone_number_key" ON "beneficiaries"("phone_number");

-- CreateIndex
CREATE INDEX "beneficiaries_phone_number_idx" ON "beneficiaries"("phone_number");

-- CreateIndex
CREATE INDEX "beneficiaries_district_id_idx" ON "beneficiaries"("district_id");

-- CreateIndex
CREATE INDEX "beneficiaries_block_id_idx" ON "beneficiaries"("block_id");

-- CreateIndex
CREATE INDEX "beneficiaries_village_id_idx" ON "beneficiaries"("village_id");

-- CreateIndex
CREATE INDEX "beneficiaries_status_created_at_idx" ON "beneficiaries"("status", "created_at");

-- CreateIndex
CREATE INDEX "beneficiaries_name_idx" ON "beneficiaries"("name");

-- CreateIndex
CREATE INDEX "land_holdings_beneficiary_id_status_idx" ON "land_holdings"("beneficiary_id", "status");

-- CreateIndex
CREATE INDEX "land_holdings_beneficiary_id_idx" ON "land_holdings"("beneficiary_id");

-- CreateIndex
CREATE INDEX "land_holdings_project_id_idx" ON "land_holdings"("project_id");

-- CreateIndex
CREATE INDEX "land_parcels_land_id_idx" ON "land_parcels"("land_id");

-- CreateIndex
CREATE UNIQUE INDEX "land_parcels_land_id_survey_number_subdivision_number_key" ON "land_parcels"("land_id", "survey_number", "subdivision_number");

-- CreateIndex
CREATE INDEX "rate_configurations_project_id_effective_from_idx" ON "rate_configurations"("project_id", "effective_from");

-- CreateIndex
CREATE INDEX "rate_configurations_project_id_is_active_idx" ON "rate_configurations"("project_id", "is_active");

-- CreateIndex
CREATE INDEX "installment_templates_project_id_idx" ON "installment_templates"("project_id");

-- CreateIndex
CREATE INDEX "water_applications_beneficiary_id_status_idx" ON "water_applications"("beneficiary_id", "status");

-- CreateIndex
CREATE INDEX "water_applications_land_id_status_idx" ON "water_applications"("land_id", "status");

-- CreateIndex
CREATE INDEX "water_applications_beneficiary_id_idx" ON "water_applications"("beneficiary_id");

-- CreateIndex
CREATE INDEX "water_applications_project_id_idx" ON "water_applications"("project_id");

-- CreateIndex
CREATE INDEX "water_applications_land_id_idx" ON "water_applications"("land_id");

-- CreateIndex
CREATE UNIQUE INDEX "water_allotments_application_id_key" ON "water_allotments"("application_id");

-- CreateIndex
CREATE INDEX "water_allotments_beneficiary_id_idx" ON "water_allotments"("beneficiary_id");

-- CreateIndex
CREATE INDEX "water_allotments_rate_id_idx" ON "water_allotments"("rate_id");

-- CreateIndex
CREATE UNIQUE INDEX "development_bills_allotment_id_key" ON "development_bills"("allotment_id");

-- CreateIndex
CREATE INDEX "development_bills_beneficiary_id_status_idx" ON "development_bills"("beneficiary_id", "status");

-- CreateIndex
CREATE INDEX "development_bills_beneficiary_id_idx" ON "development_bills"("beneficiary_id");

-- CreateIndex
CREATE INDEX "development_bills_created_at_idx" ON "development_bills"("created_at");

-- CreateIndex
CREATE INDEX "installments_bill_id_status_idx" ON "installments"("bill_id", "status");

-- CreateIndex
CREATE INDEX "installments_bill_id_idx" ON "installments"("bill_id");

-- CreateIndex
CREATE INDEX "installments_status_idx" ON "installments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "installments_bill_id_installment_number_key" ON "installments"("bill_id", "installment_number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receipt_number_key" ON "payments"("receipt_number");

-- CreateIndex
CREATE INDEX "payments_beneficiary_id_payment_date_idx" ON "payments"("beneficiary_id", "payment_date");

-- CreateIndex
CREATE INDEX "payments_installment_id_is_reversal_idx" ON "payments"("installment_id", "is_reversal");

-- CreateIndex
CREATE INDEX "payments_beneficiary_id_idx" ON "payments"("beneficiary_id");

-- CreateIndex
CREATE INDEX "payments_installment_id_idx" ON "payments"("installment_id");

-- CreateIndex
CREATE INDEX "payments_running_bill_id_idx" ON "payments"("running_bill_id");

-- CreateIndex
CREATE INDEX "payments_receipt_number_idx" ON "payments"("receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "infrastructure_allotment_id_key" ON "infrastructure"("allotment_id");

-- CreateIndex
CREATE INDEX "infrastructure_beneficiary_id_idx" ON "infrastructure"("beneficiary_id");

-- CreateIndex
CREATE INDEX "infrastructure_status_idx" ON "infrastructure"("status");

-- CreateIndex
CREATE INDEX "infrastructure_running_charge_start_date_idx" ON "infrastructure"("running_charge_start_date");

-- CreateIndex
CREATE UNIQUE INDEX "billing_periods_period_code_key" ON "billing_periods"("period_code");

-- CreateIndex
CREATE INDEX "billing_periods_status_idx" ON "billing_periods"("status");

-- CreateIndex
CREATE INDEX "billing_periods_period_start_idx" ON "billing_periods"("period_start");

-- CreateIndex
CREATE INDEX "billing_periods_period_end_idx" ON "billing_periods"("period_end");

-- CreateIndex
CREATE INDEX "water_usage_records_beneficiary_id_idx" ON "water_usage_records"("beneficiary_id");

-- CreateIndex
CREATE INDEX "water_usage_records_billing_period_id_idx" ON "water_usage_records"("billing_period_id");

-- CreateIndex
CREATE INDEX "water_usage_records_status_idx" ON "water_usage_records"("status");

-- CreateIndex
CREATE INDEX "water_usage_records_collection_date_idx" ON "water_usage_records"("collection_date");

-- CreateIndex
CREATE UNIQUE INDEX "water_usage_records_allotment_id_billing_period_id_key" ON "water_usage_records"("allotment_id", "billing_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "running_bills_bill_number_key" ON "running_bills"("bill_number");

-- CreateIndex
CREATE UNIQUE INDEX "running_bills_usage_id_key" ON "running_bills"("usage_id");

-- CreateIndex
CREATE INDEX "running_bills_allotment_id_idx" ON "running_bills"("allotment_id");

-- CreateIndex
CREATE INDEX "running_bills_beneficiary_id_idx" ON "running_bills"("beneficiary_id");

-- CreateIndex
CREATE INDEX "running_bills_billing_period_idx" ON "running_bills"("billing_period");

-- CreateIndex
CREATE INDEX "running_bills_billing_period_id_idx" ON "running_bills"("billing_period_id");

-- CreateIndex
CREATE INDEX "running_bills_status_idx" ON "running_bills"("status");

-- CreateIndex
CREATE INDEX "running_bills_is_legacy_idx" ON "running_bills"("is_legacy");

-- CreateIndex
CREATE INDEX "extensions_beneficiary_id_idx" ON "extensions"("beneficiary_id");

-- CreateIndex
CREATE INDEX "extensions_original_allotment_id_idx" ON "extensions"("original_allotment_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "beneficiary_documents_beneficiary_id_category_idx" ON "beneficiary_documents"("beneficiary_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "report_presets_name_key" ON "report_presets"("name");

-- CreateIndex
CREATE INDEX "report_presets_category_idx" ON "report_presets"("category");

-- CreateIndex
CREATE INDEX "report_presets_is_active_idx" ON "report_presets"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "sync_operations_client_op_id_key" ON "sync_operations"("client_op_id");

-- CreateIndex
CREATE INDEX "sync_operations_device_id_created_at_idx" ON "sync_operations"("device_id", "created_at");

-- CreateIndex
CREATE INDEX "sync_operations_entity_type_entity_id_idx" ON "sync_operations"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "server_change_feed_feed_id_idx" ON "server_change_feed"("feed_id");

-- CreateIndex
CREATE INDEX "server_change_feed_entity_type_entity_id_idx" ON "server_change_feed"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "device_registrations_is_active_idx" ON "device_registrations"("is_active");

-- CreateIndex
CREATE INDEX "beneficiary_advance_ledger_beneficiary_id_idx" ON "beneficiary_advance_ledger"("beneficiary_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("district_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panchayats" ADD CONSTRAINT "panchayats_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("district_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "villages" ADD CONSTRAINT "villages_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("block_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "villages" ADD CONSTRAINT "villages_panchayat_id_fkey" FOREIGN KEY ("panchayat_id") REFERENCES "panchayats"("panchayat_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("district_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "blocks"("block_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_panchayat_id_fkey" FOREIGN KEY ("panchayat_id") REFERENCES "panchayats"("panchayat_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_village_id_fkey" FOREIGN KEY ("village_id") REFERENCES "villages"("village_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "land_holdings" ADD CONSTRAINT "land_holdings_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "land_holdings" ADD CONSTRAINT "land_holdings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "land_parcels" ADD CONSTRAINT "land_parcels_land_id_fkey" FOREIGN KEY ("land_id") REFERENCES "land_holdings"("land_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_configurations" ADD CONSTRAINT "rate_configurations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_templates" ADD CONSTRAINT "installment_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_applications" ADD CONSTRAINT "water_applications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_applications" ADD CONSTRAINT "water_applications_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_applications" ADD CONSTRAINT "water_applications_land_id_fkey" FOREIGN KEY ("land_id") REFERENCES "land_holdings"("land_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_allotments" ADD CONSTRAINT "water_allotments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "water_applications"("application_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_allotments" ADD CONSTRAINT "water_allotments_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_allotments" ADD CONSTRAINT "water_allotments_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "rate_configurations"("rate_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_bills" ADD CONSTRAINT "development_bills_allotment_id_fkey" FOREIGN KEY ("allotment_id") REFERENCES "water_allotments"("allotment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_bills" ADD CONSTRAINT "development_bills_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "development_bills"("bill_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("installment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_running_bill_id_fkey" FOREIGN KEY ("running_bill_id") REFERENCES "running_bills"("running_bill_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_extension_id_fkey" FOREIGN KEY ("extension_id") REFERENCES "extensions"("extension_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "infrastructure" ADD CONSTRAINT "infrastructure_allotment_id_fkey" FOREIGN KEY ("allotment_id") REFERENCES "water_allotments"("allotment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "infrastructure" ADD CONSTRAINT "infrastructure_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_usage_records" ADD CONSTRAINT "water_usage_records_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_usage_records" ADD CONSTRAINT "water_usage_records_allotment_id_fkey" FOREIGN KEY ("allotment_id") REFERENCES "water_allotments"("allotment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_usage_records" ADD CONSTRAINT "water_usage_records_infrastructure_id_fkey" FOREIGN KEY ("infrastructure_id") REFERENCES "infrastructure"("infrastructure_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_usage_records" ADD CONSTRAINT "water_usage_records_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods"("billing_period_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_usage_records" ADD CONSTRAINT "water_usage_records_collection_agent_id_fkey" FOREIGN KEY ("collection_agent_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "running_bills" ADD CONSTRAINT "running_bills_allotment_id_fkey" FOREIGN KEY ("allotment_id") REFERENCES "water_allotments"("allotment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "running_bills" ADD CONSTRAINT "running_bills_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "running_bills" ADD CONSTRAINT "running_bills_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "rate_configurations"("rate_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "running_bills" ADD CONSTRAINT "running_bills_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods"("billing_period_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "running_bills" ADD CONSTRAINT "running_bills_usage_id_fkey" FOREIGN KEY ("usage_id") REFERENCES "water_usage_records"("usage_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_original_allotment_id_fkey" FOREIGN KEY ("original_allotment_id") REFERENCES "water_allotments"("allotment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "rate_configurations"("rate_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiary_documents" ADD CONSTRAINT "beneficiary_documents_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficiary_advance_ledger" ADD CONSTRAINT "beneficiary_advance_ledger_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("beneficiary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

