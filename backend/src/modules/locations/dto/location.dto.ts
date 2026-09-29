import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDistrictDto {
  @ApiProperty({ example: 'Coimbatore' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 528 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lgdDistrictCode?: number;
}

export class CreateBlockDto {
  @ApiProperty({ example: 'UUID of district' })
  @IsUUID()
  @IsNotEmpty()
  districtId: string;

  @ApiProperty({ example: 6482 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lgdBlockCode: number;

  @ApiProperty({ example: 'Pollachi North' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateVillageDto {
  @ApiPropertyOptional({ example: 'UUID of block' })
  @IsOptional()
  @IsUUID()
  blockId?: string;

  @ApiPropertyOptional({ example: 'UUID of legacy panchayat' })
  @IsOptional()
  @IsUUID()
  panchayatId?: string;

  @ApiPropertyOptional({ example: 223994 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lgdVillageCode?: number;

  @ApiProperty({ example: 'Angambakkam' })
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

export class QueryVillagesDto {
  @ApiPropertyOptional({ example: 'anga' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;

  @ApiPropertyOptional({ example: 'UUID of block' })
  @IsOptional()
  @IsUUID()
  blockId?: string;

  @ApiPropertyOptional({ example: 'UUID of legacy panchayat' })
  @IsOptional()
  @IsUUID()
  panchayatId?: string;
}

export class QueryBlocksDto {
  @ApiPropertyOptional({ example: 'UUID of district' })
  @IsOptional()
  @IsUUID()
  districtId?: string;

  @ApiPropertyOptional({ example: 'poll' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;
}

export class LocationSearchQueryDto {
  @ApiProperty({ example: 'coimbatore' })
  @IsString()
  @IsNotEmpty()
  search: string;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
