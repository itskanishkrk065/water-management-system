import { Module } from '@nestjs/common';
import { FindFilterController } from './find-filter.controller';
import { FindFilterService } from './find-filter.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [FindFilterController],
  providers: [FindFilterService],
  exports: [FindFilterService],
})
export class ReportsModule {}
