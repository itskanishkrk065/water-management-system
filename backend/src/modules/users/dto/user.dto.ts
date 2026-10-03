import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus, RoleName } from '../../common/enums';

export class CreateUserDto {
  @ApiProperty({ example: 'officer@water.gov' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'EMP-1042' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ example: 'ramanathan_a' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'SecureTemp#2026' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({ example: 'A. Ramanathan' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'UUID of the role' })
  @IsNotEmpty()
  @IsString()
  roleId: string;

  @ApiPropertyOptional({ example: 'UUID of assigned district' })
  @IsOptional()
  @IsString()
  districtId?: string;

  @ApiPropertyOptional({ example: ['Panchayat A', 'Panchayat B'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  panchayats?: string[];

  @ApiPropertyOptional({ default: true, description: 'Force user to change password on first login' })
  @IsOptional()
  @IsBoolean()
  forcePasswordChange?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  districtId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  panchayats?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forcePasswordChange?: boolean;
}

export class QueryUsersDto {
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

  @ApiPropertyOptional({ description: 'Search by full name, email, employee ID, or phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by role ID' })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional({ enum: RoleName })
  @IsOptional()
  @IsEnum(RoleName)
  roleName?: RoleName;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Filter by district ID' })
  @IsOptional()
  @IsString()
  districtId?: string;
}

export class AssignScopeDto {
  @ApiProperty({ description: 'UUID of assigned district' })
  @IsNotEmpty()
  @IsString()
  districtId: string;

  @ApiPropertyOptional({ description: 'Specific panchayats within district', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  panchayats?: string[];
}

export class ChangeStatusDto {
  @ApiPropertyOptional({ description: 'Administrative reason for status change' })
  @IsOptional()
  @IsString()
  reason?: string;
}
