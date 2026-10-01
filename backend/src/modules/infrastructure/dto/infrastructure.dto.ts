import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InfrastructureStatus } from '../../common/enums';

export class UpdateInfrastructureStatusDto {
  @ApiProperty({ enum: InfrastructureStatus, example: InfrastructureStatus.COMMISSIONED })
  @IsEnum(InfrastructureStatus)
  @IsNotEmpty()
  status: InfrastructureStatus;

  @ApiProperty({ example: '2026-09-21T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ example: '2026-09-21T00:00:00.000Z', description: 'Individual date when running billing begins (defaults to commissioning date)', required: false })
  @IsOptional()
  @IsDateString()
  runningChargeStartDate?: string;

  @ApiProperty({ example: 'Canal pipeline, flow meter, and field control valves commissioned', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateRunningChargeStartDateDto {
  @ApiProperty({ example: '2026-10-01T00:00:00.000Z', description: 'Authoritative running charge start date' })
  @IsDateString()
  @IsNotEmpty()
  runningChargeStartDate: string;

  @ApiProperty({ example: 'Actual water discharge commenced on 01-Oct-2026', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
