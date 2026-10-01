import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus, BeneficiaryStatus } from '../../common/enums';

export class DashboardFilterDto {
  @ApiPropertyOptional({ example: 'UUID of District' })
  @IsOptional()
  @IsString()
  districtId?: string;

  @ApiPropertyOptional({ example: 'UUID of Block' })
  @IsOptional()
  @IsString()
  blockId?: string;

  @ApiPropertyOptional({ example: 'UUID of Panchayat' })
  @IsOptional()
  @IsString()
  panchayatId?: string;

  @ApiPropertyOptional({ example: 'UUID of Village' })
  @IsOptional()
  @IsString()
  villageId?: string;

  @ApiPropertyOptional({ example: 'UUID of Project Scheme' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}
