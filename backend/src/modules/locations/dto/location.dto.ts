import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDistrictDto {
  @ApiProperty({ example: 'Coimbatore' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreatePanchayatDto {
  @ApiProperty({ example: 'UUID of district' })
  @IsUUID()
  @IsNotEmpty()
  districtId: string;

  @ApiProperty({ example: 'Pollachi North' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateVillageDto {
  @ApiProperty({ example: 'UUID of panchayat' })
  @IsUUID()
  @IsNotEmpty()
  panchayatId: string;

  @ApiProperty({ example: 'Annamalai' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
