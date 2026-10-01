import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateInfrastructureStatusDto } from './dto/infrastructure.dto';
import { Prisma } from '@prisma/client';
import { AuditAction, InfrastructureStatus } from '../common/enums';

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
      remarks: dto.remarks !== undefined ? dto.remarks : existing.remarks,
    };

    if (dto.status === InfrastructureStatus.PLANNED) {
      if (!existing.planned_date || dto.date) {
        updateData.planned_date = eventDate;
      }
    } else if (dto.status === InfrastructureStatus.UNDER_CONSTRUCTION) {
      if (!existing.planned_date) {
        updateData.planned_date = existing.created_at || eventDate;
      }
      updateData.construction_start_date = dto.date ? eventDate : (existing.construction_start_date || eventDate);
    } else if (dto.status === InfrastructureStatus.COMPLETED) {
      if (!existing.planned_date) {
        updateData.planned_date = existing.created_at || eventDate;
      }
      if (!existing.construction_start_date) {
        updateData.construction_start_date = eventDate;
      }
      updateData.completion_date = dto.date ? eventDate : (existing.completion_date || eventDate);
    } else if (dto.status === InfrastructureStatus.COMMISSIONED) {
      if (!existing.planned_date) {
        updateData.planned_date = existing.created_at || eventDate;
      }
      if (!existing.construction_start_date) {
        updateData.construction_start_date = eventDate;
      }
      if (!existing.completion_date) {
        updateData.completion_date = eventDate;
      }
      const commDate = dto.date ? eventDate : (existing.commissioned_date || eventDate);
      updateData.commissioned_date = commDate;

      // Individual running charge start date defaults to commissioned_date unless explicitly provided
      if (dto.runningChargeStartDate) {
        updateData.running_charge_start_date = new Date(dto.runningChargeStartDate);
      } else if (!existing.running_charge_start_date) {
        updateData.running_charge_start_date = commDate;
      }
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

  /**
   * Allows authorized ADMIN to correct or adjust the individual runningChargeStartDate
   * when actual water usage commenced on a different date.
   */
  async updateRunningChargeStartDate(
    id: string,
    runningChargeStartDate: string,
    reason?: string,
    userId?: string,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.infrastructure.findUnique({
      where: { infrastructure_id: id },
    });
    if (!existing) {
      throw new NotFoundException(`Infrastructure ${id} not found`);
    }

    const newStartDate = new Date(runningChargeStartDate);

    const updated = await this.prisma.infrastructure.update({
      where: { infrastructure_id: id },
      data: {
        running_charge_start_date: newStartDate,
      },
      include: {
        beneficiary: true,
        allotment: true,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'Infrastructure',
      entityId: id,
      oldValues: { running_charge_start_date: existing.running_charge_start_date },
      newValues: { running_charge_start_date: updated.running_charge_start_date },
      reason: reason || `Updated running charge start date to ${newStartDate.toISOString().slice(0, 10)}`,
      ipAddress,
    });

    return updated;
  }
}
