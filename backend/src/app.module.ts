import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { SystemModule } from './modules/system/system.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { BeneficiariesModule } from './modules/beneficiaries/beneficiaries.module';
import { LandModule } from './modules/land/land.module';
import { RatesModule } from './modules/rates/rates.module';
import { WaterModule } from './modules/water/water.module';
import { BillingModule } from './modules/billing/billing.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InfrastructureModule } from './modules/infrastructure/infrastructure.module';
import { ExtensionsModule } from './modules/extensions/extensions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { BeneficiaryPortalModule } from './modules/beneficiary-portal/beneficiary-portal.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BackupModule } from './modules/backup/backup.module';
import { IntegrityModule } from './modules/integrity/integrity.module';
import { SearchModule } from './modules/search/search.module';
import { DeveloperModule } from './modules/developer/developer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SystemModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    LocationsModule,
    ProjectsModule,
    BeneficiariesModule,
    LandModule,
    RatesModule,
    WaterModule,
    BillingModule,
    PaymentsModule,
    InfrastructureModule,
    ExtensionsModule,
    DashboardModule,
    BeneficiaryPortalModule,
    ReportsModule,
    BackupModule,
    IntegrityModule,
    SearchModule,
    DeveloperModule,
  ],
})
export class AppModule {}
