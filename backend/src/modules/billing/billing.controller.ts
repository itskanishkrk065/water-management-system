import { Controller, Get, Post, Put, Param, Body, Query, UseGuards, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { RunningBillingService } from './running-billing.service';
import { BillingCalendarService } from './billing-calendar.service';
import {
  CreateInstallmentTemplateDto,
  GenerateRunningBillDto,
  PreviewRunningBillsDto,
} from './dto/billing.dto';
import {
  RecordWaterUsageDto,
  GenerateBillFromUsageDto,
  ReviewOverAllocationDto,
  VoidUsageRecordDto,
  RunningChargesFilterDto,
  UpdateBillingPeriodDto,
  EligibleBeneficiariesFilterDto,
  SaveConsumptionDraftsDto,
  GenerateBatchRunningBillsDto,
} from './dto/running-charges.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { BillStatus, InstallmentStatus, RoleName } from '../common/enums';

@ApiTags('Billing, Installments & Running Charges')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly runningBillingService: RunningBillingService,
    private readonly calendarService: BillingCalendarService,
  ) {}

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
  // MONTHLY BILLING CALENDAR ENDPOINTS (Part 4, 5, 40)
  // =========================================================================

  @Get('calendar/periods')
  @ApiOperation({ summary: 'List monthly billing periods' })
  async getCalendarPeriods() {
    return this.calendarService.getPeriods();
  }

  @Get('calendar/periods/:code')
  @ApiOperation({ summary: 'Get single billing period detail' })
  async getCalendarPeriod(@Param('code') code: string) {
    return this.calendarService.getPeriod(code);
  }

  @Post('calendar/reconcile')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Reconcile billing calendar based on application clock' })
  async reconcileCalendar() {
    return this.calendarService.reconcile();
  }

  @Put('calendar/periods/:code')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Configure collection dates and payment due dates for an open period' })
  async updateCalendarPeriod(
    @Param('code') code: string,
    @Body() dto: UpdateBillingPeriodDto,
  ) {
    return this.calendarService.updatePeriodConfig(code, dto as any);
  }

  // =========================================================================
  // RUNNING CHARGES ELIGIBILITY & FIELD COLLECTION (Part 3, 8, 9, 10, 11)
  // =========================================================================

  @Get('eligibility/:allotmentId')
  @ApiOperation({ summary: 'Get authoritative running charges eligibility and rate snapshot' })
  async getEligibility(
    @Param('allotmentId') allotmentId: string,
    @Query('billingPeriod') billingPeriod?: string,
  ) {
    return this.runningBillingService.getEligibility(allotmentId, billingPeriod);
  }

  @Post('usage')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Record actual water usage for a beneficiary and billing period' })
  async recordWaterUsage(
    @Body() dto: RecordWaterUsageDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.runningBillingService.recordWaterUsage(dto, user.user_id, ip);
  }

  @Get('usage')
  @ApiOperation({ summary: 'List water usage records with search, filter, and pagination' })
  async getUsageRecords(@Query() query: RunningChargesFilterDto) {
    return this.runningBillingService.getUsageRecords(query);
  }

  @Get('usage/:id')
  @ApiOperation({ summary: 'Get single water usage record detail' })
  async getOneUsageRecord(@Param('id') id: string) {
    return this.runningBillingService.findOneUsageRecord(id);
  }

  @Post('usage/:id/generate-bill')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS, RoleName.FIELD_OFFICER)
  @ApiOperation({ summary: 'Generate running bill from verified water usage record' })
  async generateBillFromUsage(
    @Param('id') id: string,
    @Body() dto: Partial<GenerateBillFromUsageDto>,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.runningBillingService.generateBillFromUsage(id, user.user_id, ip, dto);
  }

  @Post('usage/:id/review')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Review over-allocation water usage record (Admin authorized)' })
  async reviewOverAllocationUsage(
    @Param('id') id: string,
    @Body() dto: ReviewOverAllocationDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.runningBillingService.reviewOverAllocationUsage(id, dto, user.user_id, ip);
  }

  @Post('usage/:id/void')
  @Roles(RoleName.ADMIN)
  @ApiOperation({ summary: 'Void unbilled water usage record with mandatory reason' })
  async voidUsageRecord(
    @Param('id') id: string,
    @Body() dto: VoidUsageRecordDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.runningBillingService.voidUsageRecord(id, dto, user.user_id, ip);
  }

  @Get('running-charges/eligible-beneficiaries')
  @ApiOperation({ summary: 'List eligible beneficiaries for month-end running billing' })
  async getEligibleBeneficiaries(@Query() query: EligibleBeneficiariesFilterDto) {
    return this.runningBillingService.getEligibleBeneficiariesForMonthEnd(query);
  }

  @Post('running-charges/save-drafts')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Save draft monthly consumption entries' })
  async saveConsumptionDrafts(
    @Body() dto: SaveConsumptionDraftsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.runningBillingService.saveConsumptionDrafts(dto, user.user_id);
  }

  @Post('running-charges/generate-batch')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Generate RunningBills in batch for entered monthly consumption values' })
  async generateBatchRunningBills(
    @Body() dto: GenerateBatchRunningBillsDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.runningBillingService.generateBatchRunningBills(dto, user.user_id, ip);
  }

  // =========================================================================
  // RUNNING BILLS & DASHBOARD ENDPOINTS
  // =========================================================================

  @Get('running-bills/summary')
  @ApiOperation({ summary: 'Get authoritative running charges summary metrics for selected billing period' })
  async getRunningBillsSummary(
    @Query('billingPeriod') billingPeriod?: string,
    @Query('districtId') districtId?: string,
  ) {
    return this.runningBillingService.getRunningBillsSummary({ billingPeriod, districtId });
  }

  @Post('running-bills/preview')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Preview running bills generation (redirects to eligibility verification)' })
  async previewRunningBills(@Body() dto: PreviewRunningBillsDto) {
    return this.billingService.previewRunningBills(dto);
  }

  @Post('running-bills/batch-generate')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Batch generate running bills for eligible beneficiaries' })
  async generateLegacyBatchRunningBills(
    @Body() dto: any,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.billingService.generateBatchRunningBills(dto, user.user_id, ip);
  }

  @Post('running-bills/generate')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Generate individual running charges bill' })
  async generateRunningBill(
    @Body() dto: GenerateRunningBillDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.billingService.generateRunningBill(dto, user.user_id, ip);
  }

  @Get('running-bills')
  @ApiOperation({ summary: 'List running charge bills with search, filter, and pagination' })
  async getRunningBills(@Query() query: RunningChargesFilterDto) {
    return this.runningBillingService.findAllRunningBills(query);
  }

  @Get('running-bills/:id')
  @ApiOperation({ summary: 'Get single running bill detail with calculation breakdown, usage, and payments' })
  async getOneRunningBill(@Param('id') id: string) {
    return this.runningBillingService.findOneRunningBill(id);
  }
}

