import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../common/enums';
import { BackupService } from './backup.service';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBackupDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RestoreBackupDto {
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

@ApiTags('Database & Backup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('integrity')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Check SQLite database integrity and consistency' })
  async checkIntegrity() {
    return this.backupService.checkIntegrity();
  }

  @Get('list')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'List available .wmbak local offline backup archives' })
  async listBackups() {
    return this.backupService.listBackups();
  }

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create full offline .wmbak system backup archive' })
  async createBackup(
    @Body() dto: CreateBackupDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.backupService.createBackup(user.user_id, dto.reason, ip);
  }

  @Post('restore')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Restore system database and documents from a verified .wmbak archive' })
  async restoreBackup(
    @Body() dto: RestoreBackupDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.backupService.restoreBackup(dto.fileName, user.user_id, dto.reason, ip);
  }
}
