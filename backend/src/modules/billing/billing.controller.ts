import { Controller, Get, Post, Param, Body, Query, UseGuards, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import {
  CreateInstallmentTemplateDto,
  GenerateRunningBillDto,
  PreviewRunningBillsDto,
  GenerateBatchRunningBillsDto,
} from './dto/billing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { BillStatus, InstallmentStatus, RoleName } from '../common/enums';

@ApiTags('Billing & Installments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('development-bills')
  @ApiOperation({ summary: 'List development bills' })
  async getDevelopmentBills(
    @Query('beneficiaryId') beneficiaryId?: string,
    @Query('status') status?: BillStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findAllDevelopmentBills({
      beneficiaryId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('development-bills/:id')
  @ApiOperation({ summary: 'Get development bill with 5 installment records' })
  async getDevelopmentBill(@Param('id') id: string) {
    return this.billingService.findOneDevelopmentBill(id);
  }

  @Get('installments')
  @ApiOperation({ summary: 'List all installments with status and payment tracking' })
  async getInstallments(
    @Query('billId') billId?: string,
    @Query('status') status?: InstallmentStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findAllInstallments({
      billId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('installment-templates')
  @ApiOperation({ summary: 'List installment schedule templates' })
  async getInstallmentTemplates(@Query('projectId') projectId?: string) {
    return this.billingService.getInstallmentTemplates(projectId);
  }

  @Post('installment-templates')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Create versioned 5-installment schedule template (Must sum to 100%)' })
  async createInstallmentTemplate(
    @Body() dto: CreateInstallmentTemplateDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.billingService.createInstallmentTemplate(dto, user.email, user.user_id, ip);
  }

  // =========================================================================
  // RUNNING BILLS ENDPOINTS
  // =========================================================================

  @Get('running-bills/summary')
  @ApiOperation({ summary: 'Get top-level running charges summary cards metrics' })
  async getRunningBillsSummary(
    @Query('billingPeriod') billingPeriod?: string,
    @Query('districtId') districtId?: string,
  ) {
    return this.billingService.getRunningBillsSummary({ billingPeriod, districtId });
  }

  @Post('running-bills/preview')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Preview running bills generation with eligibility and rate breakdown' })
  async previewRunningBills(@Body() dto: PreviewRunningBillsDto) {
    return this.billingService.previewRunningBills(dto);
  }

  @Post('running-bills/batch-generate')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Batch generate running bills for eligible beneficiaries' })
  async generateBatchRunningBills(
    @Body() dto: GenerateBatchRunningBillsDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.billingService.generateBatchRunningBills(dto, user.user_id, ip);
  }

  @Post('running-bills/generate')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Generate individual running charges bill (Gated by individual running start date)' })
  async generateRunningBill(
    @Body() dto: GenerateRunningBillDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.billingService.generateRunningBill(dto, user.user_id, ip);
  }

  @Get('running-bills')
  @ApiOperation({ summary: 'List running charge bills with search, filter, and pagination' })
  async getRunningBills(
    @Query('beneficiaryId') beneficiaryId?: string,
    @Query('allotmentId') allotmentId?: string,
    @Query('status') status?: BillStatus,
    @Query('billingPeriod') billingPeriod?: string,
    @Query('districtId') districtId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findAllRunningBills({
      beneficiaryId,
      allotmentId,
      status,
      billingPeriod,
      districtId,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('running-bills/:id')
  @ApiOperation({ summary: 'Get single running bill detail with calculation breakdown and payments' })
  async getOneRunningBill(@Param('id') id: string) {
    return this.billingService.findOneRunningBill(id);
  }
}
