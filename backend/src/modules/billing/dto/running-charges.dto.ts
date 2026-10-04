import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { UsageEntryMode, WaterUsageStatus, BillStatus } from '../../common/enums';

export class RecordWaterUsageDto {
  @ApiProperty({ description: 'Water Allotment ID' })
  @IsString()
  @IsNotEmpty()
  allotmentId: string;

  @ApiProperty({ description: 'Billing Period Code, e.g. 2026-10', example: '2026-10' })
  @IsString()
  @IsNotEmpty()
  billingPeriod: string;

  @ApiProperty({ enum: UsageEntryMode, default: UsageEntryMode.DIRECT })
  @IsEnum(UsageEntryMode)
  usageEntryMode: UsageEntryMode;

  @ApiPropertyOptional({ description: 'Actual water usage in litres (required for DIRECT mode)' })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Actual usage cannot be negative' })
  actualUsageLitres?: number;

  @ApiPropertyOptional({ description: 'Previous meter reading in litres (required for METER_READING mode)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  previousMeterReading?: number;

  @ApiPropertyOptional({ description: 'Current meter reading in litres (required for METER_READING mode)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentMeterReading?: number;

  @ApiPropertyOptional({ description: 'Date of field collection visit', example: '2026-10-15T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  collectionDate?: string;

  @ApiPropertyOptional({ description: 'Field notes or observations' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'If true, generates RunningBill immediately upon saving valid usage', default: false })
  @IsOptional()
  @IsBoolean()
  generateBillImmediately?: boolean;
}

export class GenerateBillFromUsageDto {
  @ApiProperty({ description: 'Water Usage Record ID' })
  @IsString()
  @IsNotEmpty()
  usageId: string;

  @ApiPropertyOptional({ description: 'Custom due date override' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Authorize generation for OVER_ALLOCATION status' })
  @IsOptional()
  @IsBoolean()
  overrideOverAllocation?: boolean;
}

export class ReviewOverAllocationDto {
  @ApiProperty({ description: 'Whether over-allocation is approved for billing' })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ description: 'Approval or rejection remarks' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class VoidUsageRecordDto {
  @ApiProperty({ description: 'Mandatory reason for voiding usage record' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class RunningChargesFilterDto {
  @ApiPropertyOptional({ description: 'Billing period, e.g. 2026-10' })
  @IsOptional()
  @IsString()
  billingPeriod?: string;

  @ApiPropertyOptional({ description: 'Beneficiary ID filter' })
  @IsOptional()
  @IsString()
  beneficiaryId?: string;

  @ApiPropertyOptional({ description: 'Allotment ID filter' })
  @IsOptional()
  @IsString()
  allotmentId?: string;

  @ApiPropertyOptional({ description: 'District ID filter' })
  @IsOptional()
  @IsString()
  districtId?: string;

  @ApiPropertyOptional({ description: 'Status filter' })
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Search term (beneficiary name, phone, bill number, notes)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: string;
}

export class UpdateBillingPeriodDto {
  @ApiPropertyOptional({ description: 'Collection start date' })
  @IsOptional()
  @IsDateString()
  collectionStartDate?: string;

  @ApiPropertyOptional({ description: 'Collection end date' })
  @IsOptional()
  @IsDateString()
  collectionEndDate?: string;

  @ApiPropertyOptional({ description: 'Payment due date' })
  @IsOptional()
  @IsDateString()
  paymentDueDate?: string;

  @ApiPropertyOptional({ description: 'Status' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class ConsumptionEntryItemDto {
  @ApiProperty({ description: 'Water Allotment ID' })
  @IsString()
  @IsNotEmpty()
  allotmentId: string;

  @ApiProperty({ description: 'Actual monthly consumption in litres' })
  @IsNumber()
  @Min(0, { message: 'Monthly consumption cannot be negative' })
  actualMonthlyConsumptionLiters: number;
}

export class SaveConsumptionDraftsDto {
  @ApiProperty({ description: 'Billing Period Code, e.g. 2026-10' })
  @IsString()
  @IsNotEmpty()
  billingPeriod: string;

  @ApiProperty({ type: [ConsumptionEntryItemDto] })
  entries: ConsumptionEntryItemDto[];
}

export class GenerateBatchRunningBillsDto {
  @ApiProperty({ description: 'Billing Period Code, e.g. 2026-10' })
  @IsString()
  @IsNotEmpty()
  billingPeriod: string;

  @ApiProperty({ type: [ConsumptionEntryItemDto] })
  entries: ConsumptionEntryItemDto[];
}

export class EligibleBeneficiariesFilterDto {
  @ApiPropertyOptional({ description: 'Billing period, e.g. 2026-10' })
  @IsOptional()
  @IsString()
  billingPeriod?: string;

  @ApiPropertyOptional({ description: 'District ID filter' })
  @IsOptional()
  @IsString()
  districtId?: string;

  @ApiPropertyOptional({ description: 'Panchayat/Block ID filter' })
  @IsOptional()
  @IsString()
  blockId?: string;

  @ApiPropertyOptional({ description: 'Village ID filter' })
  @IsOptional()
  @IsString()
  villageId?: string;

  @ApiPropertyOptional({ description: 'Project Scheme ID filter' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Search term (beneficiary name, phone, code)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by entry status: ALL | PENDING_ENTRY | ENTERED | WITHIN_TOLERANCE | BELOW_TOLERANCE | ABOVE_TOLERANCE | BILL_GENERATED | NOT_BILLED' })
  @IsOptional()
  @IsString()
  entryStatus?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: string;
}
