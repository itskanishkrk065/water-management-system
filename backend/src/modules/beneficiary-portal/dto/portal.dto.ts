import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LocationDirection, DocumentCategory } from '../../common/enums';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Survey Field 101, Canal Road' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'North Ward' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Near Old Panchayat Post' })
  @IsOptional()
  @IsString()
  addressLine3?: string;

  @ApiPropertyOptional({ example: 'UUID of District' })
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional({ example: 'UUID of Block' })
  @IsOptional()
  @IsUUID()
  blockId?: string;

  @ApiPropertyOptional({ example: 'UUID of Panchayat' })
  @IsOptional()
  @IsUUID()
  panchayatId?: string;

  @ApiPropertyOptional({ example: 'UUID of Village' })
  @IsOptional()
  @IsUUID()
  villageId?: string;

  @ApiPropertyOptional({ example: '642001' })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ enum: LocationDirection, example: 'NORTH' })
  @IsOptional()
  @IsEnum(LocationDirection)
  locationDirection?: LocationDirection;

  @ApiPropertyOptional({ example: 'North-facing farm border near primary school' })
  @IsOptional()
  @IsString()
  locationDescription?: string;
}

export class CreatePortalParcelDto {
  @ApiProperty({ example: '101' })
  @IsNotEmpty()
  @IsString()
  surveyNumber: string;

  @ApiPropertyOptional({ example: '1A' })
  @IsOptional()
  @IsString()
  subdivisionNumber?: string;

  @ApiProperty({ example: 1.5 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  areaAcres: number;
}

export class CreatePortalLandDto {
  @ApiPropertyOptional({ example: 'UUID of Project Scheme' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 'PATTA-2026-99' })
  @IsOptional()
  @IsString()
  pattaNumber?: string;

  @ApiProperty({ example: 3.0, description: 'Declared total extent in acres' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  declaredTotalArea: number;

  @ApiProperty({ type: [CreatePortalParcelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePortalParcelDto)
  parcels: CreatePortalParcelDto[];
}

export class SubmitWaterApplicationDto {
  @ApiProperty({ example: 35000, description: 'Required water volume in litres' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  requiredLitres: number;

  @ApiPropertyOptional({ example: 'Rabi season pulse crop cultivation' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateExtensionRequestDto {
  @ApiPropertyOptional({ example: 1.5, description: 'Additional land acres declared' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  additionalAcres?: number;

  @ApiProperty({ example: 15000, description: 'Additional water requirement in litres' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  additionalLitres: number;

  @ApiPropertyOptional({ example: 'Acquired adjacent subdivision parcel' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentCategory, example: 'LAND_RECORD' })
  @IsNotEmpty()
  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @ApiProperty({ example: 'Patta Revenue Document' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'patta_doc_101.pdf' })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @ApiPropertyOptional({ example: 1048576 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fileSizeBytes?: number;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({ example: '/documents/patta_doc_101.pdf' })
  @IsNotEmpty()
  @IsString()
  storagePath: string;

  @ApiPropertyOptional({ example: 'UUID of associated entity' })
  @IsOptional()
  @IsUUID()
  referenceId?: string;
}
