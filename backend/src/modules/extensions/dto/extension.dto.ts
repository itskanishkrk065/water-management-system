import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExtensionType, ExtensionStatus } from '../../common/enums';

export class CreateExtensionRequestDto {
  @ApiProperty({ example: 'UUID of Beneficiary' })
  @IsUUID()
  @IsNotEmpty()
  beneficiaryId: string;

  @ApiProperty({ example: 'UUID of Original Water Allotment', required: false })
  @IsOptional()
  @IsUUID()
  originalAllotmentId?: string;

  @ApiProperty({ enum: ExtensionType, example: ExtensionType.ADDITIONAL_LAND })
  @IsOptional()
  @IsEnum(ExtensionType)
  extensionType?: ExtensionType;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isLateBeneficiary?: boolean;

  @ApiProperty({ example: 2.0000, description: 'Requested additional land in acres', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  requestedAdditionalArea?: number;

  @ApiProperty({ example: 20000, description: 'Requested additional water in litres', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  requestedAdditionalLitres?: number;

  @ApiProperty({ example: 'SF-101/A', required: false })
  @IsOptional()
  @IsString()
  surveyNumber?: string;

  @ApiProperty({ example: '2B', required: false })
  @IsOptional()
  @IsString()
  subdivisionNumber?: string;

  @ApiProperty({ example: 'UUID of District', required: false })
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiProperty({ example: 'UUID of Block', required: false })
  @IsOptional()
  @IsUUID()
  blockId?: string;

  @ApiProperty({ example: 'UUID of Panchayat', required: false })
  @IsOptional()
  @IsUUID()
  panchayatId?: string;

  @ApiProperty({ example: 'UUID of Village', required: false })
  @IsOptional()
  @IsUUID()
  villageId?: string;

  @ApiProperty({ example: 'Expanded cultivation into adjacent subdivision', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ApproveExtensionDto {
  @ApiProperty({ example: 2.0000, description: 'Approved additional land in acres', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  approvedAdditionalArea?: number;

  @ApiProperty({ example: 20000, description: 'Approved additional litres', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  approvedAdditionalLitres?: number;

  @ApiProperty({ example: 'Extension approved per regional water council review', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateLateBeneficiaryDto {
  @ApiProperty({ example: 'Jeevan Kumar' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '9876543210' })
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @ApiProperty({ example: 'UUID of Project' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ example: 'UUID of District' })
  @IsUUID()
  @IsNotEmpty()
  districtId: string;

  @ApiProperty({ example: 'UUID of Block', required: false })
  @IsOptional()
  @IsUUID()
  blockId?: string;

  @ApiProperty({ example: 'UUID of Panchayat', required: false })
  @IsOptional()
  @IsUUID()
  panchayatId?: string;

  @ApiProperty({ example: 'UUID of Village', required: false })
  @IsOptional()
  @IsUUID()
  villageId?: string;

  @ApiProperty({ example: 3.5, description: 'Land area in acres' })
  @IsNumber()
  @Min(0.0001)
  @IsNotEmpty()
  landArea: number;

  @ApiProperty({ example: 35000, description: 'Requested water in litres' })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  requestedLitres: number;

  @ApiProperty({ example: 'SF-404', required: false })
  @IsOptional()
  @IsString()
  surveyNumber?: string;

  @ApiProperty({ example: '1A', required: false })
  @IsOptional()
  @IsString()
  subdivisionNumber?: string;

  @ApiProperty({ example: 'Late connection request after project lock', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}

