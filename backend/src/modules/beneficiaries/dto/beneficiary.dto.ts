import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BeneficiaryStatus, LocationDirection } from '@prisma/client';

export class CreateBeneficiaryDto {
  @ApiProperty({ example: 'K. Ramasamy Gounder' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiPropertyOptional({ example: 'farmer@water.gov' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ example: 'Door 45, North Street' })
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @ApiPropertyOptional({ example: 'Near Murugan Temple' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Post Box 12' })
  @IsOptional()
  @IsString()
  addressLine3?: string;

  @ApiProperty({ example: 'UUID of District' })
  @IsUUID()
  @IsNotEmpty()
  districtId: string;

  @ApiPropertyOptional({ example: 'UUID of Block' })
  @IsOptional()
  @IsUUID()
  blockId?: string;

  @ApiPropertyOptional({ example: 'UUID of Legacy Panchayat' })
  @IsOptional()
  @IsUUID()
  panchayatId?: string;

  @ApiProperty({ example: 'UUID of Village' })
  @IsUUID()
  @IsNotEmpty()
  villageId: string;

  @ApiProperty({ example: '642001' })
  @IsString()
  @IsNotEmpty()
  pincode: string;

  @ApiProperty({ enum: LocationDirection, example: LocationDirection.NORTH })
  @IsEnum(LocationDirection)
  @IsNotEmpty()
  locationDirection: LocationDirection;

  @ApiPropertyOptional({ example: 'Farmland bordering the high-level canal' })
  @IsOptional()
  @IsString()
  locationDescription?: string;

  @ApiPropertyOptional({ enum: BeneficiaryStatus, default: BeneficiaryStatus.ACTIVE })
  @IsOptional()
  @IsEnum(BeneficiaryStatus)
  status?: BeneficiaryStatus;
}

export class UpdateBeneficiaryDto {
  @ApiPropertyOptional({ example: 'K. Ramasamy Gounder' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'farmer@water.gov' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Door 45, North Street' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Near Murugan Temple' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Post Box 12' })
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

  @ApiPropertyOptional({ example: 'UUID of Legacy Panchayat' })
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

  @ApiPropertyOptional({ enum: LocationDirection, example: LocationDirection.NORTH })
  @IsOptional()
  @IsEnum(LocationDirection)
  locationDirection?: LocationDirection;

  @ApiPropertyOptional({ example: 'Farmland bordering the high-level canal' })
  @IsOptional()
  @IsString()
  locationDescription?: string;

  @ApiPropertyOptional({ enum: BeneficiaryStatus })
  @IsOptional()
  @IsEnum(BeneficiaryStatus)
  status?: BeneficiaryStatus;

  @ApiPropertyOptional({ example: 'Administrative data entry correction of address details' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DeactivateBeneficiaryDto {
  @ApiProperty({ example: 'Beneficiary requested temporary pause in operational water distribution' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ReactivateBeneficiaryDto {
  @ApiProperty({ example: 'Beneficiary fulfilled land verification compliance and resumed operations' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ArchiveBeneficiaryDto {
  @ApiProperty({ example: 'Permanent archival following complete succession settlement' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class CheckDuplicateBeneficiaryDto {
  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'farmer@water.gov' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'K. Ramasamy Gounder' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'UUID of Village' })
  @IsOptional()
  @IsUUID()
  villageId?: string;
}

export class ToggleAccountStatusDto {
  @ApiProperty({ example: false, description: 'True to enable login, false to disable' })
  @IsNotEmpty()
  isActive: boolean;

  @ApiPropertyOptional({ example: 'Administrative lock requested during audit verification' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ForcePasswordResetDto {
  @ApiPropertyOptional({ example: 'User lost device access and requested authorized administrative password reset' })
  @IsOptional()
  @IsString()
  reason?: string;
}
