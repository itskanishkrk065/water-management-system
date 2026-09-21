import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRateConfigurationDto } from './dto/rate.dto';
import { AuditAction } from '@prisma/client';
import { Decimal } from 'decimal.js';

@Injectable()
export class RatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieves the currently active rate configuration for a project.
   */
  async getActiveRate(projectId: string) {
    const rate = await this.prisma.rateConfiguration.findFirst({
      where: {
        project_id: projectId,
        is_active: true,
      },
      orderBy: { effective_from: 'desc' },
      include: { project: true },
    });

    if (!rate) {
      throw new NotFoundException(`No active rate configuration found for project ${projectId}`);
    }

    return rate;
  }

  /**
   * Retrieves all historical versions of rate configurations for a project.
   */
  async getRateHistory(projectId: string) {
    return this.prisma.rateConfiguration.findMany({
      where: { project_id: projectId },
      orderBy: { effective_from: 'desc' },
      include: {
        project: { select: { project_code: true, project_name: true } },
        _count: { select: { waterAllotments: true, runningBills: true } },
      },
    });
  }

  /**
   * Creates a new versioned rate configuration.
   * NEVER mutates the existing record in place; closes the prior active rate and inserts a new version.
   */
  async createNewVersion(dto: CreateRateConfigurationDto, userEmail: string, userId?: string, ipAddress?: string) {
    const effectiveFromDate = new Date(dto.effectiveFrom);

    const project = await this.prisma.project.findUnique({
      where: { project_id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Find currently active rate
      const currentActive = await tx.rateConfiguration.findFirst({
        where: {
          project_id: dto.projectId,
          is_active: true,
        },
      });

      if (currentActive) {
        if (effectiveFromDate <= currentActive.effective_from) {
          throw new BadRequestException(
            `New rate effective date (${effectiveFromDate.toISOString()}) must be after current active rate effective date (${currentActive.effective_from.toISOString()})`,
          );
        }

        // Close prior rate
        await tx.rateConfiguration.update({
          where: { rate_id: currentActive.rate_id },
          data: {
            effective_to: effectiveFromDate,
            is_active: false,
          },
        });
      }

      // Create new version
      const newRate = await tx.rateConfiguration.create({
        data: {
          project_id: dto.projectId,
          litres_per_acre: new Decimal(dto.litresPerAcre),
          development_cost_per_litre: new Decimal(dto.developmentCostPerLitre),
          running_cost_per_litre: new Decimal(dto.runningCostPerLitre),
          effective_from: effectiveFromDate,
          effective_to: null,
          is_active: true,
          created_by: userEmail,
        },
        include: { project: true },
      });

      return { newRate, previousRate: currentActive };
    });

    await this.auditService.log({
      userId,
      action: AuditAction.RATE_CHANGED,
      entityType: 'RateConfiguration',
      entityId: result.newRate.rate_id,
      oldValues: result.previousRate,
      newValues: result.newRate,
      reason: dto.reason || 'Configured new versioned tariff rates',
      ipAddress,
    });

    return result.newRate;
  }
}
