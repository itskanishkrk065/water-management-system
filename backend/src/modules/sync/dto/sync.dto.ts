import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested, IsUUID, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncEnvelopeDto {
  @IsString()
  @IsNotEmpty()
  clientOpId: string;

  @IsString()
  @IsNotEmpty()
  operationType: string; // e.g. "RECORD_PAYMENT", "RECORD_USAGE", "UPDATE_BENEFICIARY"

  @IsString()
  @IsNotEmpty()
  entityType: string; // e.g. "Payment", "WaterUsageRecord", "Beneficiary"

  @IsString()
  @IsNotEmpty()
  entityId: string;

  @IsObject()
  @IsNotEmpty()
  payloadJson: Record<string, any>;

  @IsNumber()
  @IsOptional()
  schemaVersion?: number = 1;

  @IsNumber()
  @IsOptional()
  expectedVersion?: number;

  @IsString()
  @IsOptional()
  timestamp?: string;
}

export class SyncPushDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncEnvelopeDto)
  operations: SyncEnvelopeDto[];
}

export class SyncPullQueryDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sinceFeedId?: number = 0;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 100;
}

export class SyncAckDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsNumber()
  @Type(() => Number)
  acknowledgedFeedId: number;
}

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  deviceName: string;

  @IsString()
  @IsNotEmpty()
  appVersion: string;

  @IsString()
  @IsOptional()
  userId?: string;
}

export class RevokeDeviceDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
