import { Module } from '@nestjs/common';
import { DeveloperController } from './developer.controller';
import { DeveloperDbExplorerService } from './services/developer-db-explorer.service';
import { DeveloperCleanStateService } from './services/developer-clean-state.service';
import { DeveloperDiagnosticsService } from './services/developer-diagnostics.service';
import { DeveloperTestDataService } from './services/developer-test-data.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupModule } from '../backup/backup.module';
import { IntegrityModule } from '../integrity/integrity.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, BackupModule, IntegrityModule, AuditModule],
  controllers: [DeveloperController],
  providers: [
    DeveloperDbExplorerService,
    DeveloperCleanStateService,
    DeveloperDiagnosticsService,
    DeveloperTestDataService,
  ],
  exports: [
    DeveloperDbExplorerService,
    DeveloperCleanStateService,
    DeveloperDiagnosticsService,
    DeveloperTestDataService,
  ],
})
export class DeveloperModule {}
