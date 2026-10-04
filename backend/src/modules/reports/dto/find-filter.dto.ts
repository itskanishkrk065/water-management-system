import {
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsEnum,
  IsArray,
  Min,
  Max,
  IsDateString,
  IsInt,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BeneficiaryStatus,
  ApplicationStatus,
  ApprovalStatus,
  BillStatus,
  InstallmentStatus,
  PaymentMode,
  InfrastructureStatus,
  ExtensionStatus,
} from '../../common/enums';

export type PaymentSummaryStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE';

export enum ReportingDateType {
  APPLICATION_DATE = 'application_date',
  APPROVAL_DATE = 'approval_date',
  PAYMENT_DATE = 'payment_date',
  PLANNED_DATE = 'planned_date',
  COMMISSIONED_DATE = 'commissioned_date',
  EXTENSION_DATE = 'extension_date',
  CREATED_AT = 'created_at',
}

export class FindFilterDto {
  @ApiPropertyOptional({ example: 'Search name, phone, or village' })
  @IsOptional()
  @IsString()
  search?: string;

  // 1. Location & Project Filters
  @ApiPropertyOptional({ example: 'UUID of Project Scheme' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ example: 'UUID of District' })
  @IsOptional()
  @IsString()
  districtId?: string;

  @ApiPropertyOptional({ example: 'UUID of Block' })
  @IsOptional()
  @IsString()
  blockId?: string;

  @ApiPropertyOptional({ example: 'UUID of Panchayat' })
  @IsOptional()
  @IsString()
  panchayatId?: string;

  @ApiPropertyOptional({ example: 'UUID of Village' })
  @IsOptional()
  @IsString()
  villageId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Multi-select villages' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  villageIds?: string[];

  // 2. Beneficiary Filters
  @ApiPropertyOptional({ example: 'Ravi' })
  @IsOptional()
  @IsString()
  beneficiaryName?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ enum: BeneficiaryStatus, example: BeneficiaryStatus.ACTIVE })
  @IsOptional()
  @IsEnum(BeneficiaryStatus)
  @Transform(({ value, obj }) => value || obj?.status)
  beneficiaryStatus?: BeneficiaryStatus;

  @ApiPropertyOptional({ enum: BeneficiaryStatus, example: BeneficiaryStatus.ACTIVE, description: 'Alias for beneficiaryStatus' })
  @IsOptional()
  @IsEnum(BeneficiaryStatus)
  status?: BeneficiaryStatus;

  // 3. Land Filters
  @ApiPropertyOptional({ example: 1.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  landAreaMin?: number;

  @ApiPropertyOptional({ example: 10.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  landAreaMax?: number;

  @ApiPropertyOptional({ example: '101' })
  @IsOptional()
  @IsString()
  surveyNumber?: string;

  @ApiPropertyOptional({ example: '1A' })
  @IsOptional()
  @IsString()
  subdivisionNumber?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  holdingCountMin?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  holdingCountMax?: number;

  // 4. Water Filters
  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  requiredLitresMin?: number;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  requiredLitresMax?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  calculatedLitresMin?: number;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  calculatedLitresMax?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  approvedLitresMin?: number;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  approvedLitresMax?: number;

  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  applicationStatus?: ApplicationStatus;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  // 5. Billing & Payment Status Filters
  @ApiPropertyOptional({ enum: BillStatus })
  @IsOptional()
  @IsEnum(BillStatus)
  developmentBillStatus?: BillStatus;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  developmentCostMin?: number;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  developmentCostMax?: number;

  @ApiPropertyOptional({ example: 'UNPAID', enum: ['PAID', 'PARTIALLY_PAID', 'UNPAID', 'OVERDUE'] })
  @IsOptional()
  @IsString()
  paymentStatus?: PaymentSummaryStatus;

  @ApiPropertyOptional({ example: 1, enum: [1, 2, 3, 4, 5] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  installmentNumber?: number;

  @ApiPropertyOptional({ enum: InstallmentStatus })
  @IsOptional()
  @IsEnum(InstallmentStatus)
  installmentStatus?: InstallmentStatus;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  installmentAmountDueMin?: number;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  installmentAmountDueMax?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  installmentAmountPaidMin?: number;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  installmentAmountPaidMax?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  installmentPendingMin?: number;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  installmentPendingMax?: number;

  // 6. Payment Transaction Filters
  @ApiPropertyOptional({ enum: PaymentMode })
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  paymentDateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  paymentDateTo?: string;

  @ApiPropertyOptional({ example: 'PAY-REF-101' })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional({ example: 'REC-2026-0001' })
  @IsOptional()
  @IsString()
  receiptNumber?: string;

  // 7. Infrastructure Filters
  @ApiPropertyOptional({ enum: InfrastructureStatus })
  @IsOptional()
  @IsEnum(InfrastructureStatus)
  infrastructureStatus?: InfrastructureStatus;

  // 8. Running Charges Filters
  @ApiPropertyOptional({ enum: BillStatus })
  @IsOptional()
  @IsEnum(BillStatus)
  runningBillStatus?: BillStatus;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  runningAmountMin?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  runningAmountMax?: number;

  @ApiPropertyOptional({ example: '2026-03' })
  @IsOptional()
  @IsString()
  billingPeriod?: string;

  // 9. Extension Filters
  @ApiPropertyOptional({ enum: ExtensionStatus })
  @IsOptional()
  @IsEnum(ExtensionStatus)
  extensionStatus?: ExtensionStatus;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  extensionLitresMin?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  extensionLitresMax?: number;

  // 10. Date Range Filters
  @ApiPropertyOptional({ enum: ReportingDateType, example: ReportingDateType.APPLICATION_DATE })
  @IsOptional()
  @IsEnum(ReportingDateType)
  dateType?: ReportingDateType;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // 11. Pagination & Sorting
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(250)
  limit?: number = 50;

  @ApiPropertyOptional({ example: 'created_at', default: 'created_at' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'created_at';

  @ApiPropertyOptional({ example: 'desc', default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class CreatePresetDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  report_type?: string;

  @IsOptional()
  filters?: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];

  @IsOptional()
  @IsString()
  sort_by?: string;

  @IsOptional()
  @IsString()
  sort_order?: string;

  @IsOptional()
  is_system?: boolean;
}

export class UpdatePresetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  report_type?: string;

  @IsOptional()
  filters?: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columns?: string[];

  @IsOptional()
  @IsString()
  sort_by?: string;

  @IsOptional()
  @IsString()
  sort_order?: string;

  @IsOptional()
  is_active?: boolean;
}

