import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Ip,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BeneficiariesService } from './beneficiaries.service';
import {
  CreateBeneficiaryDto,
  UpdateBeneficiaryDto,
  CompleteOnboardingDto,
  DeactivateBeneficiaryDto,
  ReactivateBeneficiaryDto,
  ArchiveBeneficiaryDto,
  CheckDuplicateBeneficiaryDto,
  ToggleAccountStatusDto,
  ForcePasswordResetDto,
} from './dto/beneficiary.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { RoleName, BeneficiaryStatus } from '@prisma/client';
import { LandService } from '../land/land.service';

@ApiTags('Beneficiaries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(
    private readonly beneficiariesService: BeneficiariesService,
    private readonly landService: LandService,
  ) {}

  @Get('lookup')
  @ApiOperation({ summary: 'Lookup beneficiary by phone number (first step of onboarding)' })
  async lookup(@Query('phone') phone: string) {
    return this.beneficiariesService.lookupByPhone(phone || '');
  }

  @Post('check-duplicates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check potential duplicate beneficiaries by phone, email, or name + village' })
  async checkDuplicates(@Body() dto: CheckDuplicateBeneficiaryDto, @Query('excludeId') excludeId?: string) {
    return this.beneficiariesService.checkDuplicates(dto, excludeId);
  }

  @Post('complete-onboarding')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Atomic complete onboarding: Beneficiary + Land Holdings + Parcels + Water Applications' })
  async completeOnboarding(
    @Body() dto: CompleteOnboardingDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.beneficiariesService.completeOnboarding(dto, user.user_id, ip);
  }

  @Post()
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Create new beneficiary profile' })
  async create(
    @Body() dto: CreateBeneficiaryDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.beneficiariesService.create(dto, user.user_id, ip);
  }


  @Get()
  @ApiOperation({ summary: 'List beneficiaries with search, filters and pagination' })
  async findAll(
    @Query('search') search?: string,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('panchayatId') panchayatId?: string,
    @Query('status') status?: BeneficiaryStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.beneficiariesService.findAll({
      search,
      districtId,
      blockId,
      panchayatId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full beneficiary dossier across all operational tabs' })
  async findOne(@Param('id') id: string) {
    return this.beneficiariesService.findOne(id);
  }

  @Get(':id/overview')
  @ApiOperation({ summary: 'Get lightweight beneficiary overview profile and high-level KPIs' })
  async getOverview(@Param('id') id: string) {
    return this.beneficiariesService.getBeneficiaryOverview(id);
  }

  @Get(':id/water')
  @ApiOperation({ summary: 'Get lazy-loaded water applications and allotments for a beneficiary' })
  async getWater(@Param('id') id: string) {
    return this.beneficiariesService.getBeneficiaryWater(id);
  }

  @Get(':id/billing')
  @ApiOperation({ summary: 'Get lazy-loaded development and running bills for a beneficiary' })
  async getBilling(@Param('id') id: string) {
    return this.beneficiariesService.getBeneficiaryBilling(id);
  }

  @Get(':id/payments')
  @ApiOperation({ summary: 'Get lazy-loaded payment ledger for a beneficiary with pagination' })
  async getPayments(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.beneficiariesService.getBeneficiaryPayments(id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id/infrastructure')
  @ApiOperation({ summary: 'Get lazy-loaded infrastructure records for a beneficiary' })
  async getInfrastructure(@Param('id') id: string) {
    return this.beneficiariesService.getBeneficiaryInfrastructure(id);
  }

  @Get(':id/extensions')
  @ApiOperation({ summary: 'Get lazy-loaded water capacity extensions for a beneficiary' })
  async getExtensions(@Param('id') id: string) {
    return this.beneficiariesService.getBeneficiaryExtensions(id);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Get lazy-loaded document vault for a beneficiary' })
  async getDocuments(@Param('id') id: string) {
    return this.beneficiariesService.getBeneficiaryDocuments(id);
  }

  @Patch(':id')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Update beneficiary details with administrative correction reason' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBeneficiaryDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.beneficiariesService.update(id, dto, user.user_id, ip);
  }

  @Get(':id/obligations')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Check active obligations before deactivation' })
  async getObligations(@Param('id') id: string) {
    return this.beneficiariesService.getObligationsSummary(id);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Deactivate beneficiary with mandatory reason' })
  async deactivate(
    @Param('id') id: string,
    @Body() dto: DeactivateBeneficiaryDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.beneficiariesService.deactivateBeneficiary(id, dto.reason, user.user_id, ip);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Reactivate beneficiary' })
  async reactivate(
    @Param('id') id: string,
    @Body() dto: ReactivateBeneficiaryDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.beneficiariesService.reactivateBeneficiary(id, dto.reason, user.user_id, ip);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Archive beneficiary for historical preservation' })
  async archive(
    @Param('id') id: string,
    @Body() dto: ArchiveBeneficiaryDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.beneficiariesService.archiveBeneficiary(id, dto.reason, user.user_id, ip);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get complete chronological audit history for a beneficiary' })
  async getHistory(@Param('id') id: string) {
    return this.beneficiariesService.getBeneficiaryHistory(id);
  }

  @Post(':id/land')
  @Roles(RoleName.ADMIN, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Register a new land holding under a project scheme for a beneficiary' })
  async addLand(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.landService.createHoldingWithParcels(
      {
        beneficiaryId: id,
        projectId: dto.projectId,
        declaredTotalArea: dto.declaredTotalArea,
        areaUnit: dto.areaUnit || 'ACRES',
        status: dto.status,
        parcels: dto.parcels,
      },
      user.user_id,
      ip,
    );
  }

  @Get(':id/land')
  @ApiOperation({ summary: 'List all land holdings and parcels for a beneficiary' })
  async getLand(@Param('id') id: string) {
    return this.landService.findByBeneficiary(id);
  }
}

