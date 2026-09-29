import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get high-level summary KPIs and metrics with optional filters' })
  async getStats(
    @Query() filterDto: DashboardFilterDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.dashboardService.getStats(filterDto, user);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Get recent operational activity and pending installments' })
  async getRecentActivity(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getRecentActivity(user);
  }

  @Get('pending-approvals')
  @ApiOperation({ summary: 'Get queue of water applications pending approval' })
  async getPendingApprovals() {
    return this.dashboardService.getPendingApprovals();
  }

  @Get('infrastructure-queue')
  @ApiOperation({ summary: 'Get queue of infrastructure awaiting commissioning' })
  async getInfrastructureQueue() {
    return this.dashboardService.getInfrastructureQueue();
  }
}

