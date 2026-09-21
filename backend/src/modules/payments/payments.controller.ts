import { Controller, Get, Post, Param, Body, Query, UseGuards, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { RecordPaymentDto, ReversePaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Record payment transaction against installment, running bill, or extension (Accounts / Admin)' })
  async recordPayment(
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.paymentsService.recordPayment(dto, user.email, user.user_id, ip);
  }

  @Post(':id/reverse')
  @Roles(RoleName.ADMIN, RoleName.ACCOUNTS)
  @ApiOperation({ summary: 'Reverse a payment transaction with audit record (Accounts / Admin)' })
  async reversePayment(
    @Param('id') id: string,
    @Body() dto: ReversePaymentDto,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.paymentsService.reversePayment(id, dto, user.email, user.user_id, ip);
  }

  @Get()
  @ApiOperation({ summary: 'List payment transactions with filters and pagination' })
  async findAll(
    @Query('beneficiaryId') beneficiaryId?: string,
    @Query('installmentId') installmentId?: string,
    @Query('receiptNumber') receiptNumber?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.findAll({
      beneficiaryId,
      installmentId,
      receiptNumber,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment transaction details and receipt' })
  async findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }
}
