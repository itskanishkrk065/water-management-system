import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from 'decimal.js';
import { d, toDecimalString } from '../common/decimal.util';
import {
  UpdateProfileDto,
  CreatePortalLandDto,
  SubmitWaterApplicationDto,
  CreateExtensionRequestDto,
  UploadDocumentDto,
} from './dto/portal.dto';
import {
  AuditAction,
  ApplicationStatus,
  ExtensionStatus,
  LandStatus,
  BeneficiaryStatus,
} from '@prisma/client';

@Injectable()
export class BeneficiaryPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Helper: Resolves the authenticated beneficiary record strictly for the user ID.
   * Throws ForbiddenException if no linked profile exists.
   */
  async getAuthenticatedBeneficiary(userId: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { user_id: userId },
      include: {
        district: true,
        panchayat: true,
        village: true,
      },
    });

    if (!beneficiary) {
      throw new ForbiddenException(
        'No beneficiary profile associated with this user account. Please complete registration or contact support.',
      );
    }

    if (beneficiary.status === BeneficiaryStatus.INACTIVE) {
      throw new ForbiddenException('Beneficiary account is currently deactivated.');
    }

    return beneficiary;
  }

  /**
   * GET /beneficiary/me
   * Fetches the beneficiary profile with dynamic completion percentage calculation.
   */
  async getMyProfile(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    // Dynamic profile completion scoring (20% per domain)
    const hasPersonal = !!(b.name && b.phone_number && b.email);
    const hasAddress = !!(b.address_line_1 && b.district_id && b.panchayat_id && b.village_id && b.pincode);
    const hasLocation = !!b.location_direction;

    const [activeLandCount, applicationCount] = await Promise.all([
      this.prisma.landHolding.count({
        where: { beneficiary_id: b.beneficiary_id, status: LandStatus.ACTIVE },
      }),
      this.prisma.waterApplication.count({
        where: { beneficiary_id: b.beneficiary_id },
      }),
    ]);

    const hasLand = activeLandCount > 0;
    const hasWater = applicationCount > 0;

    let score = 0;
    if (hasPersonal) score += 20;
    if (hasAddress) score += 20;
    if (hasLocation) score += 20;
    if (hasLand) score += 20;
    if (hasWater) score += 20;

    const checklist = [
      { id: 'personal', label: 'Personal Information', completed: hasPersonal },
      { id: 'address', label: 'Address & Revenue Hierarchy', completed: hasAddress },
      { id: 'location', label: 'Geographic Direction & Details', completed: hasLocation },
      { id: 'land', label: 'Land Holdings & Survey Parcels', completed: hasLand },
      { id: 'water', label: 'Water Quota Application', completed: hasWater },
    ];

    return {
      beneficiary: b,
      completionPercent: score,
      checklist,
    };
  }

  /**
   * PATCH /beneficiary/me
   * Updates profile address and location details.
   */
  async updateMyProfile(userId: string, dto: UpdateProfileDto, ipAddress?: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    // Verify village hierarchy if villageId is provided
    if (dto.villageId) {
      const village = await this.prisma.village.findUnique({
        where: { village_id: dto.villageId },
        include: { panchayat: { include: { district: true } } },
      });
      if (!village) {
        throw new BadRequestException('Selected village does not exist');
      }
      if (dto.panchayatId && village.panchayat_id !== dto.panchayatId) {
        throw new BadRequestException('Selected village does not belong to the selected panchayat');
      }
      if (dto.districtId && village.panchayat.district_id !== dto.districtId) {
        throw new BadRequestException('Selected panchayat does not belong to the selected district');
      }
    }

    const updated = await this.prisma.beneficiary.update({
      where: { beneficiary_id: b.beneficiary_id },
      data: {
        address_line_1: dto.addressLine1 !== undefined ? dto.addressLine1 : b.address_line_1,
        address_line_2: dto.addressLine2 !== undefined ? dto.addressLine2 : b.address_line_2,
        address_line_3: dto.addressLine3 !== undefined ? dto.addressLine3 : b.address_line_3,
        district_id: dto.districtId !== undefined ? dto.districtId : b.district_id,
        panchayat_id: dto.panchayatId !== undefined ? dto.panchayatId : b.panchayat_id,
        village_id: dto.villageId !== undefined ? dto.villageId : b.village_id,
        pincode: dto.pincode !== undefined ? dto.pincode : b.pincode,
        location_direction: dto.locationDirection !== undefined ? dto.locationDirection : b.location_direction,
        location_description: dto.locationDescription !== undefined ? dto.locationDescription : b.location_description,
      },
      include: {
        district: true,
        panchayat: true,
        village: true,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'Beneficiary',
      entityId: b.beneficiary_id,
      oldValues: {
        address_line_1: b.address_line_1,
        district_id: b.district_id,
        panchayat_id: b.panchayat_id,
        village_id: b.village_id,
      },
      newValues: {
        address_line_1: updated.address_line_1,
        district_id: updated.district_id,
        panchayat_id: updated.panchayat_id,
        village_id: updated.village_id,
      },
      reason: 'Beneficiary profile setup updated by user',
      ipAddress,
    });

    return updated;
  }

  /**
   * GET /beneficiary/dashboard
   * Consolidated KPIs, overview metrics, active application and installment statuses.
   */
  async getDashboard(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    // 1. Total Land from parcels
    const holdings = await this.prisma.landHolding.findMany({
      where: { beneficiary_id: b.beneficiary_id, status: LandStatus.ACTIVE },
      include: { parcels: true },
    });

    let totalLandAcres = new Decimal(0);
    let totalParcelsCount = 0;
    for (const h of holdings) {
      for (const p of h.parcels) {
        totalLandAcres = totalLandAcres.plus(d(p.area));
        totalParcelsCount++;
      }
    }

    // 2. Latest water application
    const latestApplication = await this.prisma.waterApplication.findFirst({
      where: { beneficiary_id: b.beneficiary_id },
      orderBy: { created_at: 'desc' },
      include: { project: true },
    });

    // 3. Active allotment & development bill
    const activeAllotment = await this.prisma.waterAllotment.findFirst({
      where: { beneficiary_id: b.beneficiary_id },
      orderBy: { created_at: 'desc' },
      include: {
        developmentBill: {
          include: {
            installments: {
              orderBy: { installment_number: 'asc' },
            },
          },
        },
        infrastructure: true,
        rate: true,
      },
    });

    const latestInfra =
      activeAllotment?.infrastructure ||
      (await this.prisma.infrastructure.findFirst({
        where: {
          OR: [
            { beneficiary_id: b.beneficiary_id },
            { allotment: { beneficiary_id: b.beneficiary_id } },
          ],
        },
        orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
      }));

    // 4. Financial totals
    const devBill = activeAllotment?.developmentBill;
    const totalDevelopmentCost = devBill ? d(devBill.total_amount) : new Decimal(0);
    const totalPaid = devBill ? d(devBill.amount_paid) : new Decimal(0);
    const pendingBalance = devBill ? d(devBill.pending_amount) : new Decimal(0);

    // 5. Next unpaid installment
    const nextInstallment = devBill?.installments?.find(
      (inst) => inst.status !== 'PAID' && inst.status !== 'CANCELLED',
    ) || null;

    // 6. Running charges status
    const latestRunningBill = await this.prisma.runningBill.findFirst({
      where: { allotment: { beneficiary_id: b.beneficiary_id } },
      orderBy: { created_at: 'desc' },
    });

    // 7. Extensions
    const extensionCount = await this.prisma.extension.count({
      where: { beneficiary_id: b.beneficiary_id },
    });

    return {
      beneficiary: {
        id: b.beneficiary_id,
        name: b.name,
        phone: b.phone_number,
        email: b.email,
        village: b.village?.name || 'Not set',
      },
      metrics: {
        totalLandAcres: toDecimalString(totalLandAcres, 4),
        holdingsCount: holdings.length,
        parcelsCount: totalParcelsCount,
        requiredLitres: latestApplication ? toDecimalString(latestApplication.required_litres, 2) : '0.00',
        approvedLitres: activeAllotment ? toDecimalString(activeAllotment.approved_litres, 2) : null,
        totalDevelopmentCost: toDecimalString(totalDevelopmentCost, 2),
        totalPaid: toDecimalString(totalPaid, 2),
        pendingBalance: toDecimalString(pendingBalance, 2),
      },
      latestApplication: latestApplication
        ? {
            id: latestApplication.application_id,
            requiredLitres: toDecimalString(latestApplication.required_litres, 2),
            status: latestApplication.status,
            createdAt: latestApplication.created_at,
          }
        : null,
      activeAllotment: activeAllotment
        ? {
            id: activeAllotment.allotment_id,
            approvedLitres: toDecimalString(activeAllotment.approved_litres, 2),
            approvedAt: activeAllotment.approved_at,
            developmentCost: devBill ? toDecimalString(devBill.total_amount, 2) : '0.00',
          }
        : null,
      infrastructure: latestInfra
        ? {
            id: latestInfra.infrastructure_id,
            status: latestInfra.status,
            plannedAt: latestInfra.planned_date,
            constructionStartedAt: latestInfra.construction_start_date,
            completedAt: latestInfra.completion_date,
            commissionedAt: latestInfra.commissioned_date,
            remarks: latestInfra.remarks,
          }
        : null,
      nextInstallment: nextInstallment
        ? {
            id: nextInstallment.installment_id,
            number: nextInstallment.installment_number,
            percentage: toDecimalString(nextInstallment.percentage, 2),
            amount: toDecimalString(nextInstallment.amount_due, 2),
            pendingAmount: toDecimalString(nextInstallment.pending_amount, 2),
            status: nextInstallment.status,
            dueDate: nextInstallment.due_date,
          }
        : null,
      runningCharges: {
        isInfrastructureCommissioned: latestInfra?.status === 'COMMISSIONED',
        latestBill: latestRunningBill
          ? {
              id: latestRunningBill.running_bill_id,
              billingPeriod: latestRunningBill.billing_period,
              amount: toDecimalString(latestRunningBill.amount_due, 2),
              status: latestRunningBill.status,
            }
          : null,
      },
      extensionCount,
    };
  }

  /**
   * GET /beneficiary/land
   * Returns all holdings and parcels for this beneficiary, with total calculated land.
   */
  async getMyLand(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    const holdings = await this.prisma.landHolding.findMany({
      where: { beneficiary_id: b.beneficiary_id },
      include: {
        parcels: {
          orderBy: [{ survey_number: 'asc' }, { subdivision_number: 'asc' }],
        },
      },
      orderBy: { created_at: 'desc' },
    });

    let totalActiveAcres = new Decimal(0);
    for (const h of holdings) {
      if (h.status === LandStatus.ACTIVE) {
        for (const p of h.parcels) {
          totalActiveAcres = totalActiveAcres.plus(d(p.area));
        }
      }
    }

    return {
      totalActiveAcres: toDecimalString(totalActiveAcres, 4),
      holdings,
    };
  }

  /**
   * POST /beneficiary/land
   * Adds a new land holding with parcels, enforcing strict checksum.
   */
  async addMyLand(userId: string, dto: CreatePortalLandDto, ipAddress?: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    // Find active project
    const project = await this.prisma.project.findFirst({
      where: { status: 'ACTIVE' },
    });
    if (!project) {
      throw new BadRequestException('No active irrigation scheme project found');
    }

    // Strict parcel checksum validation
    const declared = d(dto.declaredTotalArea);
    let sumParcels = new Decimal(0);

    for (const p of dto.parcels) {
      sumParcels = sumParcels.plus(d(p.areaAcres));
    }

    const diff = declared.minus(sumParcels).abs();
    if (diff.greaterThan(new Decimal(0.0001))) {
      throw new BadRequestException(
        `Parcel area sum (${toDecimalString(sumParcels, 4)} acres) does not match declared total area (${toDecimalString(declared, 4)} acres). Difference: ${toDecimalString(diff, 4)} acres.`,
      );
    }

    const holding = await this.prisma.$transaction(async (tx) => {
      const createdHolding = await tx.landHolding.create({
        data: {
          beneficiary_id: b.beneficiary_id,
          project_id: project.project_id,
          declared_total_area: declared.toNumber(),
          area_unit: 'ACRES',
          status: LandStatus.ACTIVE,
        },
      });

      await tx.landParcel.createMany({
        data: dto.parcels.map((p) => ({
          land_id: createdHolding.land_id,
          survey_number: p.surveyNumber.trim(),
          subdivision_number: p.subdivisionNumber ? p.subdivisionNumber.trim() : '',
          area: d(p.areaAcres).toNumber(),
          area_unit: 'ACRES',
        })),
      });

      await tx.auditLog.create({
        data: {
          user_id: userId,
          action: AuditAction.CREATE,
          entity_type: 'LandHolding',
          entity_id: createdHolding.land_id,
          new_values: {
            beneficiaryId: b.beneficiary_id,
            declaredTotalArea: toDecimalString(declared, 4),
            parcelsCount: dto.parcels.length,
          },
          reason: 'Beneficiary self-service added land holding with parcels',
          ip_address: ipAddress || null,
        },
      });

      return tx.landHolding.findUnique({
        where: { land_id: createdHolding.land_id },
        include: { parcels: true },
      });
    });

    return holding;
  }

  /**
   * GET /beneficiary/land/:id
   * Scoped lookup for single holding.
   */
  async getMyLandById(userId: string, landId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(landId)) {
      throw new NotFoundException('Land holding not found or unauthorized');
    }

    const holding = await this.prisma.landHolding.findUnique({
      where: { land_id: landId },
      include: {
        parcels: {
          orderBy: [{ survey_number: 'asc' }, { subdivision_number: 'asc' }],
        },
      },
    });

    if (!holding || holding.beneficiary_id !== b.beneficiary_id) {
      throw new NotFoundException('Land holding not found or unauthorized');
    }

    // Check if referenced by approved allotment
    const hasApprovedAllotment = await this.prisma.waterAllotment.findFirst({
      where: { beneficiary_id: b.beneficiary_id },
    });

    return {
      ...holding,
      isLocked: !!hasApprovedAllotment,
    };
  }

  /**
   * GET /beneficiary/water/preview
   * Section 28 transparent calculation preview: Total Land * Litres/Acre = Calculated Allotment.
   */
  async getWaterPreview(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    // Compute total active land
    const holdings = await this.prisma.landHolding.findMany({
      where: { beneficiary_id: b.beneficiary_id, status: LandStatus.ACTIVE },
      include: { parcels: true },
    });

    let totalLandAcres = new Decimal(0);
    for (const h of holdings) {
      for (const p of h.parcels) {
        totalLandAcres = totalLandAcres.plus(d(p.area));
      }
    }

    // Active project rate
    const rate = await this.prisma.rateConfiguration.findFirst({
      where: { is_active: true },
      orderBy: { effective_from: 'desc' },
    });

    const litresPerAcre = rate ? d(rate.litres_per_acre) : new Decimal(10000);
    const devCostPerLitre = rate ? d(rate.development_cost_per_litre) : new Decimal(2.0);
    const runningCostPerLitre = rate ? d(rate.running_cost_per_litre) : new Decimal(0.5);

    const calculatedAllottedLitres = totalLandAcres.mul(litresPerAcre);
    const estimatedDevelopmentCost = calculatedAllottedLitres.mul(devCostPerLitre);

    return {
      totalLandAcres: toDecimalString(totalLandAcres, 4),
      litresPerAcre: toDecimalString(litresPerAcre, 2),
      calculatedAllottedLitres: toDecimalString(calculatedAllottedLitres, 2),
      developmentCostPerLitre: toDecimalString(devCostPerLitre, 2),
      runningCostPerLitre: toDecimalString(runningCostPerLitre, 2),
      estimatedDevelopmentCost: toDecimalString(estimatedDevelopmentCost, 2),
    };
  }

  /**
   * POST /beneficiary/water/applications
   * Submits water application for required volume.
   */
  async submitWaterApplication(userId: string, dto: SubmitWaterApplicationDto, ipAddress?: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    const project = await this.prisma.project.findFirst({ where: { status: 'ACTIVE' } });
    if (!project) throw new BadRequestException('No active project found');

    const reqLitres = d(dto.requiredLitres);
    if (reqLitres.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Required litres must be greater than 0');
    }

    const application = await this.prisma.waterApplication.create({
      data: {
        beneficiary_id: b.beneficiary_id,
        project_id: project.project_id,
        required_litres: reqLitres.toNumber(),
        status: ApplicationStatus.SUBMITTED,
        created_by: b.name,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.SUBMIT,
      entityType: 'WaterApplication',
      entityId: application.application_id,
      newValues: {
        applicationId: application.application_id,
        requiredLitres: toDecimalString(reqLitres, 2),
      },
      reason: 'Beneficiary submitted self-service water requirement application',
      ipAddress,
    });

    return application;
  }

  /**
   * GET /beneficiary/water/applications
   */
  async getMyWaterApplications(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    return this.prisma.waterApplication.findMany({
      where: { beneficiary_id: b.beneficiary_id },
      include: { project: true },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * GET /beneficiary/allotments
   */
  async getMyAllotments(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    return this.prisma.waterAllotment.findMany({
      where: { beneficiary_id: b.beneficiary_id },
      include: {
        rate: true,
        developmentBill: {
          include: {
            installments: {
              orderBy: { installment_number: 'asc' },
            },
          },
        },
        infrastructure: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * GET /beneficiary/bills
   */
  async getMyBills(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    const [developmentBills, runningBills] = await Promise.all([
      this.prisma.developmentBill.findMany({
        where: { allotment: { beneficiary_id: b.beneficiary_id } },
        include: {
          allotment: true,
          installments: { orderBy: { installment_number: 'asc' } },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.runningBill.findMany({
        where: { allotment: { beneficiary_id: b.beneficiary_id } },
        include: { rate: true },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return { developmentBills, runningBills };
  }

  /**
   * GET /beneficiary/installments
   */
  async getMyInstallments(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    const bill = await this.prisma.developmentBill.findFirst({
      where: { allotment: { beneficiary_id: b.beneficiary_id } },
      include: {
        installments: {
          orderBy: { installment_number: 'asc' },
          include: {
            payments: {
              where: { is_reversal: false },
              orderBy: { payment_date: 'desc' },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!bill) {
      return { totalDevelopmentCost: '0.00', totalPaid: '0.00', pendingBalance: '0.00', installments: [] };
    }

    return {
      billId: bill.bill_id,
      totalDevelopmentCost: toDecimalString(bill.total_amount, 2),
      totalPaid: toDecimalString(bill.amount_paid, 2),
      pendingBalance: toDecimalString(bill.pending_amount, 2),
      installments: bill.installments,
    };
  }

  /**
   * GET /beneficiary/payments
   */
  async getMyPayments(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    return this.prisma.payment.findMany({
      where: { beneficiary_id: b.beneficiary_id },
      include: {
        installment: true,
        runningBill: true,
      },
      orderBy: { payment_date: 'desc' },
    });
  }

  /**
   * GET /beneficiary/receipts/:id
   */
  async getMyReceipt(userId: string, paymentId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(paymentId)) {
      throw new NotFoundException('Receipt record not found or access denied');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { payment_id: paymentId },
      include: {
        installment: { include: { bill: { include: { allotment: { include: { application: { include: { project: true } } } } } } } },
        runningBill: { include: { allotment: { include: { application: { include: { project: true } } } } } },
        beneficiary: { include: { village: true, panchayat: true, district: true } },
      },
    });

    if (!payment || payment.beneficiary_id !== b.beneficiary_id) {
      throw new NotFoundException('Receipt record not found or access denied');
    }

    const project =
      payment.installment?.bill?.allotment?.application?.project ||
      payment.runningBill?.allotment?.application?.project ||
      { project_name: 'Kongu Water Scheme', project_code: 'WMP-2026' };

    return {
      receiptNumber: payment.receipt_number,
      paymentId: payment.payment_id,
      paymentDate: payment.payment_date,
      amount: toDecimalString(payment.amount, 2),
      paymentMode: payment.payment_mode,
      paymentReference: payment.payment_reference,
      isReversal: payment.is_reversal,
      project: {
        code: project.project_code,
        name: project.project_name,
      },
      beneficiary: {
        id: b.beneficiary_id,
        name: b.name,
        phone: b.phone_number,
        village: b.village?.name || 'N/A',
        panchayat: b.panchayat?.name || 'N/A',
        district: b.district?.name || 'N/A',
      },
      allocationInfo: payment.installment
        ? `Installment #${payment.installment.installment_number} (${toDecimalString(payment.installment.percentage, 1)}%)`
        : payment.runningBill
        ? `Running Charges Bill #${payment.runningBill.billing_period}`
        : 'Water Scheme Fee',
    };
  }

  /**
   * GET /beneficiary/infrastructure
   */
  async getMyInfrastructure(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    return this.prisma.infrastructure.findFirst({
      where: {
        OR: [
          { beneficiary_id: b.beneficiary_id },
          { allotment: { beneficiary_id: b.beneficiary_id } },
        ],
      },
      include: { allotment: true },
      orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
    });
  }

  /**
   * GET /beneficiary/running-bills
   */
  async getMyRunningBills(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    const infra = await this.prisma.infrastructure.findFirst({
      where: {
        OR: [
          { beneficiary_id: b.beneficiary_id },
          { allotment: { beneficiary_id: b.beneficiary_id } },
        ],
      },
      orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
    });

    const isCommissioned = infra?.status === 'COMMISSIONED';

    const bills = await this.prisma.runningBill.findMany({
      where: { allotment: { beneficiary_id: b.beneficiary_id } },
      orderBy: { created_at: 'desc' },
    });

    return {
      isInfrastructureCommissioned: isCommissioned,
      infrastructureStatus: infra?.status || 'NOT_PLANNED',
      commissionedAt: infra?.commissioned_date || null,
      bills,
    };
  }

  /**
   * GET /beneficiary/extensions & POST /beneficiary/extensions
   */
  async getMyExtensions(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    return this.prisma.extension.findMany({
      where: { beneficiary_id: b.beneficiary_id },
      orderBy: { created_at: 'desc' },
    });
  }

  async submitExtension(userId: string, dto: CreateExtensionRequestDto, ipAddress?: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    const activeAllotment = await this.prisma.waterAllotment.findFirst({
      where: { beneficiary_id: b.beneficiary_id },
      orderBy: { created_at: 'desc' },
      include: { rate: true },
    });

    if (!activeAllotment) {
      throw new BadRequestException('Cannot request an extension without an existing approved water allotment');
    }

    const additionalAcres = dto.additionalAcres ? d(dto.additionalAcres) : new Decimal(0);
    const additionalLitres = d(dto.additionalLitres);
    const devCostRate = d(activeAllotment.rate.development_cost_per_litre);
    const additionalCost = additionalLitres.mul(devCostRate);

    const extension = await this.prisma.extension.create({
      data: {
        original_allotment_id: activeAllotment.allotment_id,
        beneficiary_id: b.beneficiary_id,
        requested_additional_area: additionalAcres.toNumber(),
        requested_additional_litres: additionalLitres.toNumber(),
        rate_id: activeAllotment.rate_id,
        additional_development_cost_per_litre: devCostRate.toNumber(),
        extension_cost: additionalCost.toNumber(),
        status: ExtensionStatus.REQUESTED,
        remarks: dto.notes || null,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.SUBMIT,
      entityType: 'Extension',
      entityId: extension.extension_id,
      newValues: {
        additionalLitres: toDecimalString(additionalLitres, 2),
        additionalCost: toDecimalString(additionalCost, 2),
      },
      reason: 'Beneficiary submitted self-service extension request',
      ipAddress,
    });

    return extension;
  }

  /**
   * Documents: GET /beneficiary/documents & POST /beneficiary/documents
   */
  async getMyDocuments(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    return this.prisma.beneficiaryDocument.findMany({
      where: { beneficiary_id: b.beneficiary_id },
      orderBy: { created_at: 'desc' },
    });
  }

  async uploadDocument(userId: string, dto: UploadDocumentDto) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    return this.prisma.beneficiaryDocument.create({
      data: {
        beneficiary_id: b.beneficiary_id,
        category: dto.category,
        title: dto.title.trim(),
        file_name: dto.fileName.trim(),
        file_size_bytes: dto.fileSizeBytes || null,
        mime_type: dto.mimeType || 'application/pdf',
        storage_path: dto.storagePath,
        reference_id: dto.referenceId || null,
      },
    });
  }

  /**
   * GET /beneficiary/history
   * Complete chronological history sourced from actual audit records.
   */
  async getMyHistory(userId: string) {
    const b = await this.getAuthenticatedBeneficiary(userId);

    // Collect all entity IDs belonging to this beneficiary
    const [holdings, applications, allotments, extensions, payments] = await Promise.all([
      this.prisma.landHolding.findMany({ where: { beneficiary_id: b.beneficiary_id }, select: { land_id: true } }),
      this.prisma.waterApplication.findMany({ where: { beneficiary_id: b.beneficiary_id }, select: { application_id: true } }),
      this.prisma.waterAllotment.findMany({ where: { beneficiary_id: b.beneficiary_id }, select: { allotment_id: true } }),
      this.prisma.extension.findMany({ where: { beneficiary_id: b.beneficiary_id }, select: { extension_id: true } }),
      this.prisma.payment.findMany({ where: { beneficiary_id: b.beneficiary_id }, select: { payment_id: true } }),
    ]);

    const entityIds = [
      b.beneficiary_id,
      ...holdings.map((h) => h.land_id),
      ...applications.map((a) => a.application_id),
      ...allotments.map((al) => al.allotment_id),
      ...extensions.map((e) => e.extension_id),
      ...payments.map((p) => p.payment_id),
    ];

    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entity_id: { in: entityIds } },
          { user_id: userId },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return logs.map((log) => ({
      id: log.audit_id,
      timestamp: log.created_at,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      description: log.reason || `${log.action} on ${log.entity_type}`,
      details: log.new_values,
    }));
  }
}
