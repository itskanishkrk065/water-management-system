import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WaterService } from './water.service';
import { CreateWaterApplicationDto, ApproveWaterApplicationDto, RejectWaterApplicationDto } from './dto/water.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { RoleName, ApplicationStatus } from '@prisma/client';

@ApiTags('Water Applications & Allotments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('water')
export class WaterController {
  constructor(private readonly waterService: WaterService) {}

  @Get('preview-allotment')
  @ApiOperation({ summary: 'Preview calculated allotment and applicable rates before submission or approval' })
  async previewAllotment(
    @Query('beneficiaryId') beneficiaryId: string,
    @Query('projectId') projectId?: string,
    @Query('landId') landId?: string,
  ) {
    return this.waterService.previewAllotment(beneficiaryId, projectId, landId);
  }

  @Post('applications')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Submit beneficiary water requirement application (Field Officer / Admin)' })
  async createApplication(
    @Body() dto: CreateWaterApplicationDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.waterService.createApplication(dto, user.email, user.user_id, ip);
  }

  @Get('applications')
  @ApiOperation({ summary: 'List all water applications with filters' })
  async findAllApplications(
    @Query('projectId') projectId?: string,
    @Query('beneficiaryId') beneficiaryId?: string,
    @Query('status') status?: ApplicationStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.waterService.findAllApplications({
      projectId,
      beneficiaryId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Get water application details' })
  async findOneApplication(@Param('id') id: string) {
    return this.waterService.findOneApplication(id);
  }

  @Post('allotments/approve')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Atomically approve water application, snapshot rates, create bill and 5 installments (Admin only)' })
  async approveApplication(
    @Body() dto: ApproveWaterApplicationDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.waterService.approveApplication(dto, user.email, user.user_id, ip);
  }

  @Post('applications/reject')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Reject water application (Admin only)' })
  async rejectApplication(
    @Body() dto: RejectWaterApplicationDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.waterService.rejectApplication(dto, user.email, user.user_id, ip);
  }

  @Get('eligible-holdings/:beneficiaryId')
  @ApiOperation({ summary: 'Get land holdings eligible for new water applications (excludes approved/fulfilled/active applications)' })
  async getEligibleHoldings(@Param('beneficiaryId') beneficiaryId: string) {
    return this.waterService.getEligibleHoldings(beneficiaryId);
  }

  @Delete('applications/:id')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Safely delete draft or unapproved water application (Admin only)' })
  async deleteApplication(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.waterService.deleteApplication(id, user.user_id, ip);
  }

  @Post('applications/:id/cancel')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Cancel or void water application' })
  async cancelApplication(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.waterService.cancelApplication(id, reason, user.user_id, ip);
  }

  @Get('allotments')
  @ApiOperation({ summary: 'List all water allotments' })
  async findAllAllotments(
    @Query('beneficiaryId') beneficiaryId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.waterService.findAllAllotments({
      beneficiaryId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('allotments/:id')
  @ApiOperation({ summary: 'Get single water allotment with development bill, installments, and infrastructure' })
  async findOneAllotment(@Param('id') id: string) {
    return this.waterService.findOneAllotment(id);
  }
}

