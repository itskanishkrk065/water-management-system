import { SyncMetadata, SyncStatus } from './sync';

export type UserRole = 'ADMIN' | 'FIELD_OFFICER' | 'ACCOUNTS' | 'VIEWER' | 'BENEFICIARY';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface UserSession {
  user: User;
  token: string;
  deviceId: string;
  loggedInAt: string;
  isOffline: boolean;
}

export interface District {
  district_id: string;
  lgd_district_code?: number | null;
  name: string;
  is_active: boolean;
}

export interface Block {
  block_id: string;
  district_id: string;
  lgd_block_code?: number | null;
  name: string;
  is_active: boolean;
}

export interface Panchayat {
  panchayat_id: string;
  district_id: string;
  name: string;
  panchayat_name?: string;
  block_code?: string;
}

export interface Village {
  village_id: string;
  block_id?: string | null;
  panchayat_id?: string | null;
  lgd_village_code?: number | null;
  name: string;
  village_name?: string;
  village_code?: string;
  is_active: boolean;
}

export interface ProjectScheme {
  project_id: string;
  project_name: string;
  project_code: string;
  description?: string | null;
  status: 'PLANNING' | 'ACTIVE' | 'SUSPENDED' | 'COMPLETED';
  is_active: boolean;
}

export interface RateTariff {
  rate_id: string;
  project_id: string;
  project_name?: string;
  project_code?: string;
  litres_per_acre: number;
  development_cost_per_litre: number;
  running_cost_per_litre: number;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
  created_by?: string;
}

export interface SurveyParcel extends SyncMetadata {
  parcel_id: string;
  holding_id: string;
  survey_number: string;
  subdivision_number: string;
  area: number; // in acres
  area_unit?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
}

export interface LandHolding extends SyncMetadata {
  holding_id: string;
  beneficiary_id: string;
  project_id: string;
  project_name?: string;
  declared_total_area: number; // in acres
  area_unit: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  is_locked: boolean;
  parcels: SurveyParcel[];
  created_at: string;
  updated_at: string;
  // Computed eligibility
  has_active_allotment?: boolean;
}

export type WaterApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'VOIDED';

export interface WaterApplication extends SyncMetadata {
  application_id: string;
  beneficiary_id: string;
  holding_id: string;
  project_id: string;
  rate_id_snapshot: string;
  required_litres: number;
  calculated_litres: number;
  litres_per_acre_snapshot: number;
  development_cost_per_litre_snapshot: number;
  status: WaterApplicationStatus;
  application_date: string;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  beneficiary_name?: string;
  beneficiary_phone?: string;
  village_name?: string;
  allotment?: WaterAllotment | null;
}

export interface WaterAllotment extends SyncMetadata {
  allotment_id: string;
  application_id: string;
  beneficiary_id: string;
  holding_id: string;
  rate_id: string;
  total_land_acres_snapshot: number;
  litres_per_acre_snapshot: number;
  calculated_allotted_litres: number;
  approved_litres: number;
  approval_status: 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approved_at: string;
  approved_by: string;
  approval_remarks?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Installment extends SyncMetadata {
  installment_id: string;
  bill_id: string;
  installment_number: number; // 1 to 5 (2.5%, 20%, 25%, 25%, 27.5%)
  percentage: number;
  amount_due: number;
  amount_paid: number;
  pending_amount: number;
  due_date: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'WAIVED' | 'CANCELLED';
  milestone_name: string;
  created_at: string;
  updated_at: string;
}

export interface DevelopmentBill extends SyncMetadata {
  bill_id: string;
  beneficiary_id: string;
  allotment_id: string;
  approved_litres_snapshot: number;
  development_cost_per_litre_snapshot: number;
  total_amount: number;
  amount_paid: number;
  pending_amount: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  installments: Installment[];
  created_at: string;
  updated_at: string;
}

export interface RunningBill extends SyncMetadata {
  running_bill_id: string;
  allotment_id: string;
  beneficiary_id: string;
  rate_id: string;
  billing_period: string; // e.g. "2026-Q1" or "2026-03"
  approved_litres_snapshot: number;
  running_cost_per_litre_snapshot: number;
  amount_due: number;
  amount_paid: number;
  pending_amount: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

export type PaymentMode = 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'DD' | 'ONLINE' | 'OFFLINE' | 'OTHER';

export interface Payment extends SyncMetadata {
  payment_id: string;
  beneficiary_id: string;
  bill_id?: string | null;
  installment_id?: string | null;
  running_bill_id?: string | null;
  extension_id?: string | null;
  receipt_number: string;
  amount: number;
  payment_mode: PaymentMode;
  payment_reference?: string | null;
  payment_date: string;
  status: 'COMPLETED' | 'REVERSED';
  is_reversal: boolean;
  reversal_payment_id?: string | null;
  remarks?: string | null;
  recorded_by: string;
  created_at: string;
}

export type InfrastructureStatus = 'PLANNED' | 'UNDER_CONSTRUCTION' | 'COMPLETED' | 'COMMISSIONED';

export interface Infrastructure extends SyncMetadata {
  infrastructure_id: string;
  allotment_id: string;
  beneficiary_id: string;
  line_name?: string;
  status: InfrastructureStatus;
  planned_date?: string | null;
  construction_start_date?: string | null;
  completion_date?: string | null;
  commissioned_date?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  beneficiary_name?: string;
}

export type ExtensionStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Extension extends SyncMetadata {
  extension_id: string;
  beneficiary_id: string;
  original_allotment_id: string;
  requested_additional_area: number;
  requested_additional_litres: number;
  approved_additional_area?: number | null;
  approved_additional_litres?: number | null;
  rate_id?: string | null;
  additional_development_cost_per_litre?: number | null;
  extension_cost?: number | null;
  status: ExtensionStatus;
  requested_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  beneficiary_name?: string;
}

export type DocumentCategory =
  | 'LAND_RECORD'
  | 'WATER_APPLICATION'
  | 'APPROVAL_LETTER'
  | 'PAYMENT_RECEIPT'
  | 'INFRASTRUCTURE_REPORT'
  | 'EXTENSION_REQUEST'
  | 'IDENTITY'
  | 'OTHER';

export interface BeneficiaryDocument extends SyncMetadata {
  document_id: string;
  beneficiary_id: string;
  category: DocumentCategory;
  title: string;
  file_name: string;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  storage_path: string;
  reference_id?: string | null;
  created_at: string;
}

export interface Beneficiary extends SyncMetadata {
  beneficiary_id: string;
  user_id?: string | null;
  name: string;
  phone_number: string;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_line3?: string | null;
  district_id?: string | null;
  block_id?: string | null;
  panchayat_id?: string | null;
  village_id?: string | null;
  pincode?: string | null;
  location_direction?: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | null;
  location_description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  total_land_acres: number;
  created_at: string;
  updated_at: string;
  // Joins
  district_name?: string;
  block_name?: string;
  panchayat_name?: string;
  village_name?: string;
  holdings_count?: number;
  applications_count?: number;
  allotments_count?: number;
  land_holdings?: LandHolding[];
  water_applications?: WaterApplication[];
  water_allotments?: WaterAllotment[];
  development_bills?: DevelopmentBill[];
  running_bills?: RunningBill[];
  infrastructures?: Infrastructure[];
  infrastructure?: Infrastructure[];
  extensions?: Extension[];
  payments?: Payment[];
  documents?: BeneficiaryDocument[];
}

export interface RegistrationDraft {
  draft_id: string;
  step: number; // 1 to 6
  phone_number: string;
  name: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  district_id?: string;
  block_id?: string;
  panchayat_id?: string;
  village_id?: string;
  pincode?: string;
  location_direction?: string;
  location_description?: string;
  holdings_json: string;
  water_required_litres?: number;
  project_id?: string;
  created_at: string;
  updated_at: string;
}
