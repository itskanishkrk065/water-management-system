import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncConflictService } from './sync-conflict.service';
import { ClientSyncWorkerService } from './client-sync-worker.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { SystemModule } from '../system/system.module';

@Module({
  imports: [PrismaModule, AuditModule, SystemModule],
  controllers: [SyncController],
  providers: [SyncService, SyncConflictService, ClientSyncWorkerService],
  exports: [SyncService, SyncConflictService, ClientSyncWorkerService],
})
export class SyncModule {}
