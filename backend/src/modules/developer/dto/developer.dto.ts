import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DeveloperModeEnum {
  READ_ONLY = 'READ_ONLY',
  CONTROLLED_WRITE = 'CONTROLLED_WRITE',
  DESTRUCTIVE_RESET = 'DESTRUCTIVE_RESET',
}

export enum CleanStateModeEnum {
  EMPTY_CLEAN_STATE = 'EMPTY_CLEAN_STATE',
  DEMO_CLEAN_STATE = 'DEMO_CLEAN_STATE',
  MODULE_RESET = 'MODULE_RESET',
  FULL_APPLICATION_RESET = 'FULL_APPLICATION_RESET',
}

export enum AppEnvironmentEnum {
  DEVELOPMENT = 'DEVELOPMENT',
  TEST = 'TEST',
  STAGING = 'STAGING',
  PRODUCTION = 'PRODUCTION',
}

export class QueryTableDataDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(250)
  @Type(() => Number)
  limit?: number = 25;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'JSON stringified column-value filter map' })
  @IsOptional()
  @IsString()
  filters?: string;
}

export class ExecuteReadOnlySqlDto {
  @ApiProperty({ example: 'SELECT * FROM beneficiaries LIMIT 10' })
  @IsString()
  @IsNotEmpty()
  sql: string;
}

export class CleanStatePreviewDto {
  @ApiProperty({ enum: CleanStateModeEnum, default: CleanStateModeEnum.EMPTY_CLEAN_STATE })
  @IsEnum(CleanStateModeEnum)
  @IsNotEmpty()
  mode: CleanStateModeEnum;

  @ApiPropertyOptional({ type: [String], description: 'Selected module names for MODULE_RESET' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];
}

export class CleanStateExecuteDto {
  @ApiProperty({ enum: CleanStateModeEnum })
  @IsEnum(CleanStateModeEnum)
  @IsNotEmpty()
  mode: CleanStateModeEnum;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];

  @ApiProperty({ description: 'Must match required phrase: RESET DATABASE or exact mode phrase' })
  @IsString()
  @IsNotEmpty()
  confirmationPhrase: string;

  @ApiPropertyOptional({ description: 'Reason for performing reset operation' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Bypass key if running on production (requires environment override)' })
  @IsOptional()
  @IsString()
  productionBypassKey?: string;
}

export class GenerateTestDataDto {
  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  count?: number = 5;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeHoldings?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeWaterApplications?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeApprovedAllotments?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeBillingAndPayments?: boolean = true;
}

export class PurgeTestDataDto {
  @ApiProperty({ example: 'PURGE TEST DATA' })
  @IsString()
  @IsNotEmpty()
  confirmationPhrase: string;
}

export class RbacTesterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ example: 'ADMIN' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ example: 'DATABASE_WRITE' })
  @IsString()
  @IsNotEmpty()
  permission: string;

  @ApiPropertyOptional({ example: 'WaterApplication' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ example: 'DELETE' })
  @IsOptional()
  @IsString()
  action?: string;
}

export class SetEnvironmentConfigDto {
  @ApiProperty({ enum: AppEnvironmentEnum })
  @IsEnum(AppEnvironmentEnum)
  @IsNotEmpty()
  environment: AppEnvironmentEnum;

  @ApiProperty({ example: 'CONFIRM ENVIRONMENT CHANGE' })
  @IsString()
  @IsNotEmpty()
  confirmationPhrase: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
