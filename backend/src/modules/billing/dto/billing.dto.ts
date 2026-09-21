import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
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

  @ApiProperty({ example: '2026-Q1', description: 'Billing period identifier (e.g. 2026-Q1 or 2026-10)' })
  @IsString()
  @IsNotEmpty()
  billingPeriod: string;
}
