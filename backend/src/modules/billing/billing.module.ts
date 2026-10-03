import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { RunningBillingService } from './running-billing.service';
import { BillingCalendarService } from './billing-calendar.service';
import { ApplicationClockService } from '../system/application-clock.service';
import { BillingController } from './billing.controller';
import { RatesModule } from '../rates/rates.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [RatesModule, AuditModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    RunningBillingService,
    BillingCalendarService,
    ApplicationClockService,
  ],
  exports: [
    BillingService,
    RunningBillingService,
    BillingCalendarService,
    ApplicationClockService,
  ],
})
export class BillingModule {}

