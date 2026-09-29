import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';

export interface LogAuditOptions {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  reason?: string;
  ipAddress?: string;
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(options: LogAuditOptions) {
    const client = options.tx || this.prisma;
    return client.auditLog.create({
      data: {
        user_id: options.userId || null,
        action: options.action,
        entity_type: options.entityType,
        entity_id: options.entityId,
        old_values: options.oldValues ? (typeof options.oldValues === 'string' ? options.oldValues : JSON.stringify(options.oldValues)) : null,
        new_values: options.newValues ? (typeof options.newValues === 'string' ? options.newValues : JSON.stringify(options.newValues)) : null,
        reason: options.reason || null,
        ip_address: options.ipAddress || null,
      },
    });
  }

  async findAll(query: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: AuditAction;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.entityType) where.entity_type = query.entityType;
    if (query.entityId) where.entity_id = query.entityId;
    if (query.userId) where.user_id = query.userId;
    if (query.action) where.action = query.action;

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
