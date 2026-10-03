import { Module, Global } from '@nestjs/common';
import { ApplicationClockService } from './application-clock.service';
import { EnvironmentConfigService } from './environment-config.service';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [HealthController],
  providers: [ApplicationClockService, EnvironmentConfigService],
  exports: [ApplicationClockService, EnvironmentConfigService],
})
export class SystemModule {}
