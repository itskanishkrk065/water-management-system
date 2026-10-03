import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { QueryDevicesDto, DeviceActionDto, LinkDeviceUserDto } from './dto/device.dto';
import { DeviceStatus, AuditAction, RoleName } from '../common/enums';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: QueryDevicesDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.userId) {
      where.user_id = query.userId;
    }

    if (query.platform) {
      where.platform = query.platform;
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { device_id: { contains: q } },
        { device_name: { contains: q } },
        { user: { email: { contains: q } } },
        { user: { full_name: { contains: q } } },
      ];
    }

    const [total, devices] = await Promise.all([
      (this.prisma as any).deviceRegistration.count({ where }),
      (this.prisma as any).deviceRegistration.findMany({
        where,
        orderBy: { last_sync_at: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              user_id: true,
              email: true,
              full_name: true,
              role: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return {
      items: devices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(deviceId: string) {
    const device = await (this.prisma as any).deviceRegistration.findUnique({
      where: { device_id: deviceId },
      include: {
        user: {
          select: {
            user_id: true,
            email: true,
            full_name: true,
            role: { select: { name: true } },
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID '${deviceId}' not found`);
    }

    return device;
  }

  async revokeDevice(deviceId: string, adminId?: string, reason?: string) {
    const device = await this.findOne(deviceId);

    const updated = await (this.prisma as any).deviceRegistration.update({
      where: { device_id: deviceId },
      data: {
        status: DeviceStatus.REVOKED,
        is_active: false,
        revoked_at: new Date(),
        revoked_by: adminId || null,
        revocation_reason: reason || 'Revoked by administrator',
      },
    });

    await this.auditService.log({
      userId: adminId || null,
      actorRole: RoleName.ADMIN,
      deviceId,
      action: AuditAction.UPDATE,
      entityType: 'DeviceRegistration',
      entityId: deviceId,
      oldValues: { status: device.status, is_active: device.is_active },
      newValues: { status: DeviceStatus.REVOKED, is_active: false },
      reason: reason || 'Device authorization revoked',
    });

    return updated;
  }

  async blockDevice(deviceId: string, adminId?: string, reason?: string) {
    const device = await this.findOne(deviceId);

    const updated = await (this.prisma as any).deviceRegistration.update({
      where: { device_id: deviceId },
      data: {
        status: DeviceStatus.BLOCKED,
        is_active: false,
        revoked_at: new Date(),
        revoked_by: adminId || null,
        revocation_reason: reason || 'Blocked by security administrator',
      },
    });

    await this.auditService.log({
      userId: adminId || null,
      actorRole: RoleName.ADMIN,
      deviceId,
      action: AuditAction.UPDATE,
      entityType: 'DeviceRegistration',
      entityId: deviceId,
      oldValues: { status: device.status, is_active: device.is_active },
      newValues: { status: DeviceStatus.BLOCKED, is_active: false },
      reason: reason || 'Device blocked due to policy or security violation',
    });

    return updated;
  }

  async unblockDevice(deviceId: string, adminId?: string) {
    const device = await this.findOne(deviceId);

    const updated = await (this.prisma as any).deviceRegistration.update({
      where: { device_id: deviceId },
      data: {
        status: DeviceStatus.ACTIVE,
        is_active: true,
        revoked_at: null,
        revoked_by: null,
        revocation_reason: null,
      },
    });

    await this.auditService.log({
      userId: adminId || null,
      actorRole: RoleName.ADMIN,
      deviceId,
      action: AuditAction.UPDATE,
      entityType: 'DeviceRegistration',
      entityId: deviceId,
      oldValues: { status: device.status },
      newValues: { status: DeviceStatus.ACTIVE, is_active: true },
      reason: 'Device unblocked and restored to ACTIVE status',
    });

    return updated;
  }

  async linkUser(deviceId: string, dto: LinkDeviceUserDto, adminId?: string) {
    await this.findOne(deviceId);

    const user = await this.prisma.user.findUnique({
      where: { user_id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID '${dto.userId}' not found`);
    }

    const updated = await (this.prisma as any).deviceRegistration.update({
      where: { device_id: deviceId },
      data: {
        user_id: dto.userId,
      },
      include: {
        user: {
          select: { user_id: true, email: true, full_name: true },
        },
      },
    });

    await this.auditService.log({
      userId: adminId || null,
      actorRole: RoleName.ADMIN,
      deviceId,
      action: AuditAction.UPDATE,
      entityType: 'DeviceRegistration',
      entityId: deviceId,
      newValues: { userId: dto.userId, userEmail: user.email },
      reason: `Device ${deviceId} linked to staff user ${user.email}`,
    });

    return updated;
  }
}
