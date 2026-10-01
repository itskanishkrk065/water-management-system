import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRateConfigurationDto {
  @ApiProperty({ example: 'UUID of Project' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ example: 'STANDARD', description: 'Tariff rate type/category', required: false })
  @IsOptional()
  @IsString()
  rateType?: string;

  @ApiProperty({ example: 'TAR-2026-02', description: 'Custom or auto-generated tariff version identifier', required: false })
  @IsOptional()
  @IsString()
  versionCode?: string;

  @ApiProperty({ example: 10000, description: 'Litres allotted per acre of land' })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  litresPerAcre: number;

  @ApiProperty({ example: 2.0, description: 'Development cost in INR per litre' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  developmentCostPerLitre: number;

  @ApiProperty({ example: 0.5, description: 'Running / maintenance cost in INR per litre' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  runningCostPerLitre: number;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z', description: 'Effective start date for this version' })
  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z', description: 'Optional effective end date', required: false })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiProperty({ example: 'Annual tariff revision', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResolveTariffQueryDto {
  @ApiProperty({ example: 'UUID of Project', required: false })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ example: 'STANDARD', required: false })
  @IsOptional()
  @IsString()
  rateType?: string;
}
