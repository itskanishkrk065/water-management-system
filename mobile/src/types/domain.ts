import { SyncMetadata, SyncStatus } from './sync';

export type UserRole = 'ADMIN' | 'FIELD_OFFICER';

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
  name: string;
  code?: string;
}

export interface Block {
  block_id: string;
  district_id: string;
  name: string;
  code?: string;
}

export interface Village {
  village_id: string;
  block_id: string;
  name: string;
  code?: string;
}

export interface ProjectScheme {
  project_id: string;
  project_name: string;
  project_code: string;
  is_active: boolean;
}

export interface RateTariff {
  rate_id: string;
  project_id: string;
  litres_per_acre: number;
  development_cost_per_litre: number;
  running_cost_per_litre: number;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
}

export interface SurveyParcel extends SyncMetadata {
  parcel_id: string;
  holding_id: string;
  survey_number: string;
  subdivision_number: string;
  area: number; // in acres
  status: 'ACTIVE' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
}

export interface LandHolding extends SyncMetadata {
  holding_id: string;
  beneficiary_id: string;
  project_id: string;
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
  approved_litres: number;
  approved_at: string;
  approved_by: string;
  is_active: boolean;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
}

export interface Installment extends SyncMetadata {
  installment_id: string;
  bill_id: string;
  installment_number: number; // 1 to 5
  percentage: number; // 2.5, 20, 25, 25, 27.5
  amount_due: number;
  amount_paid: number;
  pending_amount: number;
  due_date: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
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

export interface Payment extends SyncMetadata {
  payment_id: string;
  bill_id: string;
  installment_id?: string | null;
  beneficiary_id: string;
  receipt_number: string;
  amount: number;
  payment_mode: 'CASH' | 'CHEQUE' | 'NEFT' | 'RTGS' | 'UPI' | 'OFFLINE';
  payment_reference?: string | null;
  payment_date: string;
  is_reversal: boolean;
  created_at: string;
}

export interface Beneficiary extends SyncMetadata {
  beneficiary_id: string;
  name: string;
  phone_number: string;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_line3?: string | null;
  district_id: string;
  block_id: string;
  village_id: string;
  pincode: string;
  location_direction?: string | null;
  location_description?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  total_land_acres: number;
  created_at: string;
  updated_at: string;
  // Joins
  district_name?: string;
  block_name?: string;
  village_name?: string;
  holdings_count?: number;
  applications_count?: number;
  allotments_count?: number;
  land_holdings?: LandHolding[];
}

export interface RegistrationDraft {
  draft_id: string;
  step: number; // 1 = Phone, 2 = Details, 3 = Location, 4 = Land, 5 = Water, 6 = Review
  phone_number: string;
  name: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  district_id: string;
  block_id: string;
  village_id: string;
  pincode: string;
  holdings_json: string; // Serialized Array of holdings with parcels
  water_required_litres?: number;
  project_id?: string;
  created_at: string;
  updated_at: string;
}
