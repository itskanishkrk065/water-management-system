import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationClockService } from './application-clock.service';

@ApiTags('System Health & Probes')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clockService: ApplicationClockService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Comprehensive system health check' })
  async getHealth() {
    let dbStatus = 'UP';
    let dbError = null;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err: any) {
      dbStatus = 'DOWN';
      dbError = err.message;
    }

    let clockStatus = 'VALID';
    let clockError = null;
    try {
      const clockCheck = await this.clockService.checkClockRollback();
      if (clockCheck.rollbackDetected) {
        clockStatus = 'ROLLBACK_DETECTED';
        clockError = 'System clock rollback detected';
      }
    } catch (err: any) {
      clockStatus = 'ERROR';
      clockError = err.message;
    }

    const isHealthy = dbStatus === 'UP' && clockStatus === 'VALID';

    const response = {
      status: isHealthy ? 'HEALTHY' : 'UNHEALTHY',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      components: {
        database: { status: dbStatus, error: dbError },
        systemClock: { status: clockStatus, error: clockError },
      },
    };

    if (!isHealthy) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process liveness probe for orchestrators' })
  getLiveness() {
    return {
      status: 'UP',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Process readiness probe verifying DB connectivity' })
  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'READY',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      throw new ServiceUnavailableException({
        status: 'NOT_READY',
        error: `Database ping failed: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
