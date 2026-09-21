import { Controller, Get, Patch, Param, Body, Query, UseGuards, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InfrastructureService } from './infrastructure.service';
import { UpdateInfrastructureStatusDto } from './dto/infrastructure.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { InfrastructureStatus, RoleName } from '@prisma/client';

@ApiTags('Infrastructure')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('infrastructure')
export class InfrastructureController {
  constructor(private readonly infrastructureService: InfrastructureService) {}

  @Get()
  @ApiOperation({ summary: 'List infrastructure projects with filters and pagination' })
  async findAll(
    @Query('status') status?: InfrastructureStatus,
    @Query('beneficiaryId') beneficiaryId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.infrastructureService.findAll({
      status,
      beneficiaryId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get infrastructure details with allotment and beneficiary' })
  async findOne(@Param('id') id: string) {
    return this.infrastructureService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Update infrastructure lifecycle status (Admin only - Planned -> Under Construction -> Completed -> Commissioned)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInfrastructureStatusDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.infrastructureService.updateStatus(id, dto, user.user_id, ip);
  }
}
