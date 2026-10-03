import { Module, Global } from '@nestjs/common';
import { ApplicationClockService } from './application-clock.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  imports: [PrismaModule, AuditModule],
  providers: [ApplicationClockService],
  exports: [ApplicationClockService],
})
export class SystemModule {}
