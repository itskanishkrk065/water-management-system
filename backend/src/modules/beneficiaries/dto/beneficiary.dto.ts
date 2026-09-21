import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({ example: 'Door 45, North Street' })
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @ApiProperty({ example: 'Near Murugan Temple', required: false })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ example: 'Post Box 12', required: false })
  @IsOptional()
  @IsString()
  addressLine3?: string;

  @ApiProperty({ example: 'UUID of District' })
  @IsUUID()
  @IsNotEmpty()
  districtId: string;

  @ApiProperty({ example: 'UUID of Panchayat' })
  @IsUUID()
  @IsNotEmpty()
  panchayatId: string;

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

  @ApiProperty({ example: 'Farmland bordering the high-level canal', required: false })
  @IsOptional()
  @IsString()
  locationDescription?: string;

  @ApiProperty({ enum: BeneficiaryStatus, default: BeneficiaryStatus.ACTIVE })
  @IsOptional()
  @IsEnum(BeneficiaryStatus)
  status?: BeneficiaryStatus;
}

export class UpdateBeneficiaryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  addressLine3?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiProperty({ enum: LocationDirection, required: false })
  @IsOptional()
  @IsEnum(LocationDirection)
  locationDirection?: LocationDirection;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  locationDescription?: string;

  @ApiProperty({ enum: BeneficiaryStatus, required: false })
  @IsOptional()
  @IsEnum(BeneficiaryStatus)
  status?: BeneficiaryStatus;
}
