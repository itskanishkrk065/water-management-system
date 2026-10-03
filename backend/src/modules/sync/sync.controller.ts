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
} from '@nestjs/common';
import { SyncService, SyncPushResponse } from './sync.service';
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
  constructor(private readonly syncService: SyncService) {}

  /**
   * Health and sync status query. Publicly accessible for network heartbeat.
   */
  @Get('status')
  async getStatus(@Query('deviceId') deviceId?: string) {
    return this.syncService.getSyncStatus(deviceId);
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
}
