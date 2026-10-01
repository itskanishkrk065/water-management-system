import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrityService } from './integrity.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleName } from '../common/enums';

@ApiTags('Data Integrity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrity')
export class IntegrityController {
  constructor(private readonly integrityService: IntegrityService) {}

  @Get('check')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Run comprehensive data integrity audit across water applications, land holdings, billing, and payments' })
  async runAudit() {
    return this.integrityService.runFullIntegrityAudit();
  }
}
