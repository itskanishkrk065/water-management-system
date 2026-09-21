import { Controller, Get, Post, Param, Body, Query, UseGuards, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateInstallmentTemplateDto, GenerateRunningBillDto } from './dto/billing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { BillStatus, InstallmentStatus, RoleName } from '@prisma/client';

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

  @Post('running-bills/generate')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Generate running charges bill (Gated: only after infrastructure is COMMISSIONED)' })
  async generateRunningBill(
    @Body() dto: GenerateRunningBillDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.billingService.generateRunningBill(dto, user.user_id, ip);
  }

  @Get('running-bills')
  @ApiOperation({ summary: 'List running charge bills' })
  async getRunningBills(
    @Query('beneficiaryId') beneficiaryId?: string,
    @Query('allotmentId') allotmentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billingService.findAllRunningBills({
      beneficiaryId,
      allotmentId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
