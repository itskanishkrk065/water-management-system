import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateInfrastructureStatusDto } from './dto/infrastructure.dto';
import { AuditAction, InfrastructureStatus, Prisma } from '@prisma/client';

@Injectable()
export class InfrastructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: {
    status?: InfrastructureStatus;
    beneficiaryId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InfrastructureWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.beneficiaryId) where.beneficiary_id = query.beneficiaryId;

    const [items, total] = await Promise.all([
      this.prisma.infrastructure.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          beneficiary: { select: { beneficiary_id: true, name: true, phone_number: true } },
          allotment: {
            select: {
              allotment_id: true,
              approved_litres: true,
              application: { select: { project: { select: { project_name: true } } } },
            },
          },
        },
      }),
      this.prisma.infrastructure.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const infra = await this.prisma.infrastructure.findUnique({
      where: { infrastructure_id: id },
      include: {
        beneficiary: {
          include: { district: true, panchayat: true, village: true },
        },
        allotment: {
          include: {
            rate: true,
            developmentBill: true,
          },
        },
      },
    });

    if (!infra) {
      throw new NotFoundException('Infrastructure record not found');
    }

    return infra;
  }

  async updateStatus(
    id: string,
    dto: UpdateInfrastructureStatusDto,
    userId?: string,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.infrastructure.findUnique({
      where: { infrastructure_id: id },
    });
    if (!existing) {
      throw new NotFoundException(`Infrastructure ${id} not found`);
    }

    const eventDate = dto.date ? new Date(dto.date) : new Date();
    const updateData: Prisma.InfrastructureUpdateInput = {
      status: dto.status,
      remarks: dto.remarks || existing.remarks,
    };

    if (dto.status === InfrastructureStatus.UNDER_CONSTRUCTION && !existing.construction_start_date) {
      updateData.construction_start_date = eventDate;
    } else if (dto.status === InfrastructureStatus.COMPLETED && !existing.completion_date) {
      updateData.completion_date = eventDate;
    } else if (dto.status === InfrastructureStatus.COMMISSIONED && !existing.commissioned_date) {
      updateData.commissioned_date = eventDate;
    }

    const updated = await this.prisma.infrastructure.update({
      where: { infrastructure_id: id },
      data: updateData,
      include: {
        beneficiary: true,
        allotment: true,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.INFRASTRUCTURE_STATUS_CHANGED,
      entityType: 'Infrastructure',
      entityId: id,
      oldValues: existing,
      newValues: updated,
      reason: dto.remarks || `Infrastructure status transitioned to ${dto.status}`,
      ipAddress,
    });

    return updated;
  }
}
