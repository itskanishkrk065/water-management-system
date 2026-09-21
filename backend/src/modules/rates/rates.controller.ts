import { Controller, Get, Post, Body, Query, UseGuards, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RatesService } from './rates.service';
import { CreateRateConfigurationDto } from './dto/rate.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('Rate Configurations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get currently active rate configuration for a project' })
  async getActiveRate(@Query('projectId') projectId: string) {
    return this.ratesService.getActiveRate(projectId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get full historical audit log of rate changes for a project' })
  async getRateHistory(@Query('projectId') projectId: string) {
    return this.ratesService.getRateHistory(projectId);
  }

  @Post()
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create a new versioned rate configuration (Admin only - never overwrites)' })
  async createNewVersion(
    @Body() dto: CreateRateConfigurationDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.ratesService.createNewVersion(dto, user.email, user.user_id, ip);
  }
}
