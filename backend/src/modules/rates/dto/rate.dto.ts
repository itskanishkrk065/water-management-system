import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRateConfigurationDto {
  @ApiProperty({ example: 'UUID of Project' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

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

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z', description: 'Effective start date for this version' })
  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @ApiProperty({ example: 'Annual tariff revision', required: false })
  @IsOptional()
  reason?: string;
}
