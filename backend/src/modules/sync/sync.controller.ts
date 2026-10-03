import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
} from '@nestjs/common';
import { SyncService, SyncPushResponse } from './sync.service';
import { ClientSyncWorkerService } from './client-sync-worker.service';
import {
  SyncPushDto,
  SyncPullQueryDto,
  SyncAckDto,
  RegisterDeviceDto,
  RevokeDeviceDto,
} from './dto/sync.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleName } from '../common/enums';

@Controller('sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    @Optional() private readonly clientWorker?: ClientSyncWorkerService,
  ) {}

  /**
   * Health and sync status query. Publicly accessible for network heartbeat.
   */
  @Get('status')
  async getStatus(@Query('deviceId') deviceId?: string) {
    return this.syncService.getSyncStatus(deviceId);
  }

  /**
   * Client-side local outbox and synchronization diagnostics.
   */
  @Get('client-diagnostics')
  async getClientDiagnostics() {
    if (!this.clientWorker) {
      return { status: 'STANDALONE_SERVER' };
    }
    return this.clientWorker.getSyncDiagnostics();
  }

  /**
   * Triggers client-side manual outbox drain cycle.
   */
  @Post('client-drain')
  @HttpCode(HttpStatus.OK)
  async triggerClientDrain(@Query('batchSize') batchSize?: number) {
    if (!this.clientWorker) {
      return { processedCount: 0 };
    }
    return this.clientWorker.drainOutbox(batchSize ? Number(batchSize) : 50);
  }

  /**
   * Registers a client device or edge tablet.
   */
  @Post('register-device')
  @UseGuards(JwtAuthGuard)
  async registerDevice(@Body() dto: RegisterDeviceDto, @Req() req: any) {
    const actorUserId = req.user?.userId;
    return this.syncService.registerDevice(dto, actorUserId);
  }

  /**
   * Revokes a compromised or decommissioned device. Admin only.
   */
  @Post('revoke-device')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleName.ADMIN)
  async revokeDevice(@Body() dto: RevokeDeviceDto, @Req() req: any) {
    const actorUserId = req.user?.userId;
    return this.syncService.revokeDevice(dto, actorUserId);
  }

  /**
   * Primary sync push endpoint. Accepts a batch of SyncOutbox envelopes.
   */
  @Post('push')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async processPush(@Body() dto: SyncPushDto, @Req() req: any): Promise<SyncPushResponse> {
    const actorUserId = req.user?.userId;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    return this.syncService.processPush(dto, actorUserId, ipAddress);
  }

  /**
   * Incremental pull of server changes since given feed ID.
   */
  @Get('pull')
  @UseGuards(JwtAuthGuard)
  async processPull(@Query() query: SyncPullQueryDto) {
    return this.syncService.processPull(query.sinceFeedId || 0, query.limit || 100);
  }

  /**
   * Client acknowledges applied feed changes.
   */
  @Post('ack')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async processAck(@Body() dto: SyncAckDto) {
    return this.syncService.processAck(dto);
  }

  /**
   * Lists items in the local client outbox queue.
   */
  @Get('outbox')
  @UseGuards(JwtAuthGuard)
  async getOutboxItems(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ) {
    return this.syncService.getOutboxItems(status, limit ? Number(limit) : 100);
  }

  /**
   * Lists all operations currently in CONFLICT status with server state comparison.
   */
  @Get('conflicts')
  @UseGuards(JwtAuthGuard)
  async getConflicts() {
    return this.syncService.getConflicts();
  }

  /**
   * Resolves a conflict using ACCEPT_SERVER, FORCE_CLIENT, or MERGE strategy.
   */
  @Post('conflicts/:clientOpId/resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async resolveConflict(
    @Param('clientOpId') clientOpId: string,
    @Body() body: { strategy: 'ACCEPT_SERVER' | 'FORCE_CLIENT' | 'MERGE'; mergedPayload?: any },
    @Req() req: any,
  ) {
    const actorUserId = req.user?.userId;
    return this.syncService.resolveConflict(clientOpId, body, actorUserId);
  }

  /**
   * Retrieves records from the BeneficiaryAdvanceLedger for overpayment arbitration audit.
   */
  @Get('advance-ledger')
  @UseGuards(JwtAuthGuard)
  async getAdvanceLedger(@Query('beneficiaryId') beneficiaryId?: string) {
    return this.syncService.getAdvanceLedger(beneficiaryId);
  }
}
