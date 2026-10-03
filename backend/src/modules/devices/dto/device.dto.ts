import { IsNotEmpty, IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceStatus } from '../../common/enums';

export class QueryDevicesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by DeviceStatus', enum: DeviceStatus })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by platform (desktop, android, ios, web)' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ description: 'Search by device name, ID, or user email' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class DeviceActionDto {
  @ApiPropertyOptional({ description: 'Administrative reason for revocation or block' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class LinkDeviceUserDto {
  @ApiProperty({ description: 'User ID to link with device' })
  @IsNotEmpty()
  @IsString()
  userId: string;
}
