import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Ip, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LandService } from './land.service';
import { CreateLandHoldingDto, UpdateLandHoldingDto, CheckParcelAvailabilityDto } from './dto/land.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('Land Holdings & Parcels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('land')
export class LandController {
  constructor(private readonly landService: LandService) {}

  @Post('parcels/check-availability')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Real-time check for survey and subdivision number availability' })
  async checkParcelAvailability(@Body() dto: CheckParcelAvailabilityDto) {
    return this.landService.checkParcelAvailability(dto);
  }

  @Post('holdings')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Register a new land holding with validated SF/subdivision parcels' })
  async createHolding(
    @Body() dto: CreateLandHoldingDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.landService.createHoldingWithParcels(dto, user.user_id, ip);
  }

  @Get('beneficiary/:beneficiaryId')
  @ApiOperation({ summary: 'List all land holdings and parcels for a beneficiary' })
  async findByBeneficiary(@Param('beneficiaryId') beneficiaryId: string) {
    return this.landService.findByBeneficiary(beneficiaryId);
  }

  @Get('beneficiary/:beneficiaryId/total')
  @ApiOperation({ summary: 'Compute total active land in acres across all holdings for a beneficiary' })
  async getTotalBeneficiaryLand(@Param('beneficiaryId') beneficiaryId: string) {
    return this.landService.getTotalBeneficiaryLand(beneficiaryId);
  }

  @Patch('holdings/:id')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Update a land holding and its subdivision parcels' })
  async updateHolding(
    @Param('id') id: string,
    @Body() dto: UpdateLandHoldingDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.landService.updateHoldingWithParcels(id, dto, user.user_id, ip);
  }

  @Patch('holdings/:id/deactivate')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Deactivate a land holding (Admin only)' })
  async deactivateHolding(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.landService.deactivateHolding(id, user.user_id, ip);
  }

  @Delete('holdings/:id')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Permanently delete unused land holding (Admin only)' })
  async deleteHolding(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.landService.deleteHolding(id, user.user_id, ip);
  }
}


