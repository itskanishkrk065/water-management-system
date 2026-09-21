import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InfrastructureStatus } from '@prisma/client';

export class UpdateInfrastructureStatusDto {
  @ApiProperty({ enum: InfrastructureStatus, example: InfrastructureStatus.COMMISSIONED })
  @IsEnum(InfrastructureStatus)
  @IsNotEmpty()
  status: InfrastructureStatus;

  @ApiProperty({ example: '2026-09-21T00:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ example: 'Canal pipeline, flow meter, and field control valves commissioned', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}
