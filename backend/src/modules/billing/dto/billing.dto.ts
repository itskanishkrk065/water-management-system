import { IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInstallmentTemplateDto {
  @ApiProperty({ example: 'UUID of Project' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ example: 'Standard 2026 Schedule' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 2.50, description: 'Percentage for Installment 1 (defaults to 2.5%)' })
  @IsNumber()
  @Min(0.01)
  @Max(100)
  inst1Pct: number;

  @ApiProperty({ example: 20.00 })
  @IsNumber()
  @Min(0.01)
  @Max(100)
  inst2Pct: number;

  @ApiProperty({ example: 25.00 })
  @IsNumber()
  @Min(0.01)
  @Max(100)
  inst3Pct: number;

  @ApiProperty({ example: 25.00 })
  @IsNumber()
  @Min(0.01)
  @Max(100)
  inst4Pct: number;

  @ApiProperty({ example: 27.50 })
  @IsNumber()
  @Min(0.01)
  @Max(100)
  inst5Pct: number;
}

export class GenerateRunningBillDto {
  @ApiProperty({ example: 'UUID of WaterAllotment' })
  @IsUUID()
  @IsNotEmpty()
  allotmentId: string;

  @ApiProperty({ example: '2026-10', description: 'Billing period identifier (e.g. 2026-10 or 2026-Q4)' })
  @IsString()
  @IsNotEmpty()
  billingPeriod: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  billingPeriodStart?: string;

  @ApiProperty({ example: '2026-10-31T23:59:59.000Z', required: false })
  @IsOptional()
  @IsDateString()
  billingPeriodEnd?: string;

  @ApiProperty({ example: '2026-11-15T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class PreviewRunningBillsDto {
  @ApiProperty({ example: '2026-10', description: 'Billing period identifier' })
  @IsString()
  @IsNotEmpty()
  billingPeriod: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  billingPeriodStart?: string;

  @ApiProperty({ example: '2026-10-31T23:59:59.000Z', required: false })
  @IsOptional()
  @IsDateString()
  billingPeriodEnd?: string;

  @ApiProperty({ example: 'UUID of District', required: false })
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiProperty({ example: 'UUID of Beneficiary', required: false })
  @IsOptional()
  @IsUUID()
  beneficiaryId?: string;

  @ApiProperty({ example: 'UUID of Project', required: false })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class GenerateBatchRunningBillsDto {
  @ApiProperty({ example: '2026-10', description: 'Billing period identifier' })
  @IsString()
  @IsNotEmpty()
  billingPeriod: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  billingPeriodStart?: string;

  @ApiProperty({ example: '2026-10-31T23:59:59.000Z', required: false })
  @IsOptional()
  @IsDateString()
  billingPeriodEnd?: string;

  @ApiProperty({ example: '2026-11-15T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ example: ['UUID1', 'UUID2'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allotmentIds?: string[];

  @ApiProperty({ example: 'UUID of District', required: false })
  @IsOptional()
  @IsUUID()
  districtId?: string;
}
