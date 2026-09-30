import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LandStatus } from '@prisma/client';

export class CreateParcelDto {
  @ApiProperty({ example: '101' })
  @IsString()
  @IsNotEmpty()
  surveyNumber: string;

  @ApiProperty({ example: '1A' })
  @IsString()
  @IsNotEmpty()
  subdivisionNumber: string;

  @ApiProperty({ example: 2.5000, description: 'Parcel area in acres' })
  @IsNumber()
  @Min(0.0001)
  @IsNotEmpty()
  area: number;

  @ApiProperty({ example: 'ACRES', default: 'ACRES' })
  @IsOptional()
  @IsString()
  areaUnit?: string;
}

export class CreateLandHoldingDto {
  @ApiProperty({ example: 'UUID of Beneficiary' })
  @IsUUID()
  @IsNotEmpty()
  beneficiaryId: string;

  @ApiProperty({ example: 'UUID of Project' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ example: 5.0000, description: 'Total declared area for this holding in acres' })
  @IsNumber()
  @Min(0.0001)
  @IsNotEmpty()
  declaredTotalArea: number;

  @ApiProperty({ example: 'ACRES', default: 'ACRES' })
  @IsOptional()
  @IsString()
  areaUnit?: string;

  @ApiProperty({ enum: LandStatus, default: LandStatus.ACTIVE })
  @IsOptional()
  @IsEnum(LandStatus)
  status?: LandStatus;

  @ApiProperty({ type: [CreateParcelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParcelDto)
  parcels: CreateParcelDto[];
}

export class AddParcelToHoldingDto {
  @ApiProperty({ example: 'UUID of LandHolding' })
  @IsUUID()
  @IsNotEmpty()
  landId: string;

  @ApiProperty({ type: CreateParcelDto })
  @ValidateNested()
  @Type(() => CreateParcelDto)
  parcel: CreateParcelDto;
}

export class UpdateLandHoldingDto {
  @ApiPropertyOptional({ example: 'UUID of Project' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 5.0000, description: 'Total declared area for this holding in acres' })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  declaredTotalArea?: number;

  @ApiPropertyOptional({ example: 'ACRES', default: 'ACRES' })
  @IsOptional()
  @IsString()
  areaUnit?: string;

  @ApiPropertyOptional({ enum: LandStatus })
  @IsOptional()
  @IsEnum(LandStatus)
  status?: LandStatus;

  @ApiPropertyOptional({ type: [CreateParcelDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParcelDto)
  parcels?: CreateParcelDto[];
}

export class CheckParcelAvailabilityDto {
  @ApiProperty({ example: '101' })
  @IsString()
  @IsNotEmpty()
  surveyNumber: string;

  @ApiProperty({ example: '1A' })
  @IsString()
  @IsNotEmpty()
  subdivisionNumber: string;

  @ApiPropertyOptional({ example: 'UUID of parcel being edited' })
  @IsOptional()
  @IsString()
  excludeParcelId?: string;

  @ApiPropertyOptional({ example: 'UUID of parcel being edited (alias)' })
  @IsOptional()
  @IsString()
  currentParcelId?: string;

  @ApiPropertyOptional({ example: 'UUID of land holding being edited' })
  @IsOptional()
  @IsString()
  excludeLandId?: string;
}


