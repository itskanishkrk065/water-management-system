import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWaterApplicationDto {
  @ApiProperty({ example: 'UUID of Project', required: false })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ example: 'UUID of Beneficiary' })
  @IsUUID()
  @IsNotEmpty()
  beneficiaryId: string;

  @ApiProperty({ example: 'UUID of LandHolding', required: false })
  @IsOptional()
  @IsUUID()
  landId?: string;

  @ApiProperty({ example: 60000, description: 'Beneficiary stated required water in litres' })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  requiredLitres: number;

  @ApiProperty({ example: 'Application for Kharif and Rabi irrigation', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ApproveWaterApplicationDto {
  @ApiProperty({ example: 'UUID of WaterApplication' })
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty({ example: 45000, description: 'Final approved litres decided by administrator' })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  approvedLitres: number;

  @ApiProperty({ example: 'Approved based on canal capacity review', required: false })
  @IsOptional()
  @IsString()
  approvalRemarks?: string;
}

export class RejectWaterApplicationDto {
  @ApiProperty({ example: 'UUID of WaterApplication' })
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty({ example: 'Groundwater table saturation limit reached', required: true })
  @IsString()
  @IsNotEmpty()
  rejectionRemarks: string;
}
