import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRateConfigurationDto, ResolveTariffQueryDto } from './dto/rate.dto';
import { AuditAction } from '../common/enums';
import { Decimal } from 'decimal.js';

export interface TariffTimeline {
  current: any[];
  future: any[];
  historical: any[];
}

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Authoritative Tariff Resolution Service:
   * Resolves the exact rate tariff applicable to a specific date and rate type.
   * New calculations/bills MUST use this service to resolve rates.
   * Historical bills retain their immutable snapshots.
   */
  async getApplicableTariff(
    arg1?: string | { rateType?: string; date?: Date | string; calculationDate?: Date | string; projectId?: string },
    arg2?: Date | string,
    arg3?: string,
  ) {
    let rateType = 'STANDARD';
    let calculationDate: Date | string = new Date();
    let projectId: string | undefined;

    if (typeof arg1 === 'object' && arg1 !== null) {
      rateType = arg1.rateType || 'STANDARD';
      calculationDate = arg1.date || arg1.calculationDate || new Date();
      projectId = arg1.projectId;
    } else {
      if (typeof arg1 === 'string') rateType = arg1;
      if (arg2 !== undefined) calculationDate = arg2;
      if (arg3 !== undefined) projectId = arg3;
    }

    const targetDate = typeof calculationDate === 'string' ? new Date(calculationDate) : calculationDate;

    // If projectId is not supplied, resolve default active project
    let targetProjectId = projectId;
    if (!targetProjectId) {
      const defaultProj = await this.prisma.project.findFirst({ where: { status: 'ACTIVE' } });
      targetProjectId = defaultProj?.project_id;
    }

    if (!targetProjectId) {
      const firstProj = await this.prisma.project.findFirst();
      targetProjectId = firstProj?.project_id;
    }

    if (!targetProjectId) {
      throw new NotFoundException('No active project found to resolve tariff rate.');
    }

    // 1. Exact effective-date window lookup: effective_from <= targetDate AND (effective_to IS NULL OR effective_to > targetDate)
    let rate = await this.prisma.rateConfiguration.findFirst({
      where: {
        project_id: targetProjectId,
        effective_from: { lte: targetDate },
        OR: [
          { effective_to: null },
          { effective_to: { gt: targetDate } },
        ],
      },
      orderBy: { effective_from: 'desc' },
      include: { project: true },
    });

    // 2. If no rate in that exact window, check if targetDate is before the earliest rate -> return earliest rate
    if (!rate) {
      rate = await this.prisma.rateConfiguration.findFirst({
        where: { project_id: targetProjectId },
        orderBy: { effective_from: 'asc' },
        include: { project: true },
      });
    }

    // 3. Fallback: currently active rate
    if (!rate) {
      rate = await this.prisma.rateConfiguration.findFirst({
        where: { project_id: targetProjectId, is_active: true },
        orderBy: { effective_from: 'desc' },
        include: { project: true },
      });
    }

    if (!rate) {
      throw new NotFoundException(`No tariff rate configuration found for project ${targetProjectId}`);
    }

    const isRunning = rateType.toUpperCase() === 'RUNNING';
    const chosenRatePerLiter = isRunning
      ? Number(rate.running_cost_per_litre)
      : Number(rate.development_cost_per_litre);

    return {
      ...rate,
      ratePerLiter: chosenRatePerLiter,
      developmentCostPerLiter: Number(rate.development_cost_per_litre),
      runningCostPerLiter: Number(rate.running_cost_per_litre),
    };
  }


  /**
   * Retrieves the currently active rate configuration for a project.
   */
  async getActiveRate(projectId?: string) {
    return this.getApplicableTariff('STANDARD', new Date(), projectId);
  }

  /**
   * Retrieves all historical, active, and future versions of rate configurations.
   */
  async getRateHistory(projectId?: string) {
    const where = projectId ? { project_id: projectId } : {};
    return this.prisma.rateConfiguration.findMany({
      where,
      orderBy: { effective_from: 'desc' },
      include: {
        project: { select: { project_code: true, project_name: true } },
        _count: { select: { waterAllotments: true, runningBills: true } },
      },
    });
  }

  /**
   * Categorizes tariffs into Current (Active), Future, and Historical.
   */
  async getTariffTimeline(projectId?: string): Promise<TariffTimeline> {
    const all = await this.getRateHistory(projectId);
    const now = new Date();

    const current: any[] = [];
    const future: any[] = [];
    const historical: any[] = [];

    for (const rate of all) {
      const effFrom = new Date(rate.effective_from);
      const effTo = rate.effective_to ? new Date(rate.effective_to) : null;

      if (effFrom > now) {
        future.push(rate);
      } else if (!effTo || effTo > now) {
        current.push(rate);
      } else {
        historical.push(rate);
      }
    }

    return { current, future, historical };
  }

  /**
   * Creates a new versioned rate configuration with effective date boundaries.
   * Enforces non-overlapping validation for active periods.
   * Historical financial records are NEVER recalculated or modified.
   */
  async createNewVersion(
    dto: CreateRateConfigurationDto,
    userEmail: string,
    userId?: string,
    ipAddress?: string,
  ) {
    const effectiveFromDate = new Date(dto.effectiveFrom);
    const effectiveToDate = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    if (effectiveToDate && effectiveToDate <= effectiveFromDate) {
      throw new BadRequestException(
        `Effective end date (${effectiveToDate.toISOString()}) must be strictly after effective start date (${effectiveFromDate.toISOString()}).`,
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { project_id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    // Auto-generate version code if not provided
    const year = effectiveFromDate.getFullYear();
    const existingCount = await this.prisma.rateConfiguration.count({
      where: { project_id: dto.projectId },
    });
    const versionCode = dto.versionCode || `TAR-${year}-${String(existingCount + 1).padStart(2, '0')}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // Find currently active rate that is open-ended or overlapping
      const currentActive = await tx.rateConfiguration.findFirst({
        where: {
          project_id: dto.projectId,
          is_active: true,
        },
        orderBy: { effective_from: 'desc' },
      });

      if (currentActive) {
        if (effectiveFromDate <= currentActive.effective_from) {
          throw new BadRequestException(
            `New tariff effective start date (${effectiveFromDate.toISOString().slice(0, 10)}) must be after previous active tariff start date (${currentActive.effective_from.toISOString().slice(0, 10)}). Overlapping active periods are rejected.`,
          );
        }

        // Close prior active rate cleanly at the new effective start date
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
          rate_type: dto.rateType || 'STANDARD',
          version_code: versionCode,
          litres_per_acre: new Decimal(dto.litresPerAcre),
          development_cost_per_litre: new Decimal(dto.developmentCostPerLitre),
          running_cost_per_litre: new Decimal(dto.runningCostPerLitre),
          effective_from: effectiveFromDate,
          effective_to: effectiveToDate,
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
      reason: dto.reason || `Configured new versioned tariff ${versionCode} effective from ${effectiveFromDate.toISOString().slice(0, 10)}`,
      ipAddress,
    });

    return result.newRate;
  }
}
