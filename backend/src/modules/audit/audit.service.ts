import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '../common/enums';
import { Prisma } from '@prisma/client';

export interface LogAuditOptions {
  userId?: string | null;
  actorRole?: string | null;
  deviceId?: string | null;
  operationId?: string | null;
  mode?: 'ONLINE' | 'OFFLINE' | string | null;
  syncStatus?: 'SERVER_CONFIRMED' | 'PENDING_SYNC' | 'REJECTED' | string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  reason?: string;
  ipAddress?: string;
  result?: 'SUCCESS' | 'FAILURE' | string;
  tx?: Prisma.TransactionClient;
}

export interface AuditQueryOptions {
  entityType?: string;
  entityId?: string;
  userId?: string;
  actorRole?: string;
  deviceId?: string;
  action?: AuditAction;
  mode?: string;
  result?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(options: LogAuditOptions) {
    const client = options.tx || this.prisma;
    let validUserId: string | null = options.userId || null;
    if (validUserId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validUserId);
      if (!isUuid) {
        validUserId = null;
      }
    }

    return client.auditLog.create({
      data: {
        user_id: validUserId,
        actor_role: options.actorRole || null,
        device_id: options.deviceId || null,
        operation_id: options.operationId || null,
        mode: options.mode || 'ONLINE',
        sync_status: options.syncStatus || 'SERVER_CONFIRMED',
        action: options.action,
        entity_type: options.entityType,
        entity_id: options.entityId,
        old_values: options.oldValues ? (typeof options.oldValues === 'string' ? options.oldValues : JSON.stringify(options.oldValues)) : null,
        new_values: options.newValues ? (typeof options.newValues === 'string' ? options.newValues : JSON.stringify(options.newValues)) : null,
        reason: options.reason || null,
        ip_address: options.ipAddress || null,
        result: options.result || 'SUCCESS',
      },
    });
  }

  async findAll(query: AuditQueryOptions) {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.entityType) {
      const raw = query.entityType.trim();
      const upper = raw.toUpperCase();
      const lower = raw.toLowerCase();
      const simplePascal = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      const underscoredPascal = raw
        .toLowerCase()
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join('');
      const variants = Array.from(new Set([raw, upper, lower, simplePascal, underscoredPascal]));
      where.OR = variants.map((v) => ({ entity_type: v }));
    }

    if (query.entityId) where.entity_id = query.entityId;
    if (query.userId) where.user_id = query.userId;
    if (query.actorRole) where.actor_role = query.actorRole;
    if (query.deviceId) where.device_id = query.deviceId;
    if (query.action) where.action = query.action;
    if (query.mode) where.mode = query.mode;
    if (query.result) where.result = query.result;

    if (query.startDate || query.endDate) {
      where.created_at = {};
      if (query.startDate) {
        where.created_at.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.created_at.lte = new Date(query.endDate);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
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
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
