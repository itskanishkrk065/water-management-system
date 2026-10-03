import { Module } from '@nestjs/common';
import { BeneficiaryPortalController } from './beneficiary-portal.controller';
import { BeneficiaryPortalService } from './beneficiary-portal.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, AuditModule, PaymentsModule],
  controllers: [BeneficiaryPortalController],
  providers: [BeneficiaryPortalService],
  exports: [BeneficiaryPortalService],
})
export class BeneficiaryPortalModule {}
