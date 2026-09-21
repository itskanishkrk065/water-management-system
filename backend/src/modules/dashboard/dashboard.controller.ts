import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get high-level summary KPIs and metrics' })
  async getStats() {
    return this.dashboardService.getStats();
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
