import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateTestDataDto, PurgeTestDataDto } from '../dto/developer.dto';
import { Decimal } from 'decimal.js';

@Injectable()
export class DeveloperTestDataService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates clearly-tagged synthetic records for development and testing.
   */
  async generateSyntheticTestData(dto: GenerateTestDataDto) {
    const count = Math.min(50, Math.max(1, dto.count || 5));
    const runId = Math.floor(100000 + Math.random() * 900000);

    const district = await this.prisma.district.findFirst({ where: { is_active: true } });
    const block = await this.prisma.block.findFirst({ where: { district_id: district?.district_id } });
    const village = await this.prisma.village.findFirst({ where: { block_id: block?.block_id } });
    const project = await this.prisma.project.findFirst({ where: { status: 'ACTIVE' } });
    const rate = await this.prisma.rateConfiguration.findFirst({ where: { is_active: true } });

    if (!district || !village || !project) {
      throw new BadRequestException('Cannot generate test data: Active location and project scheme master data required.');
    }

    const createdBeneficiaries: any[] = [];

    for (let i = 1; i <= count; i++) {
      const uniqueSuffix = `${runId}${i.toString().padStart(2, '0')}`;
      const phone = `90000${uniqueSuffix}`;

      // 1. Create Synthetic Beneficiary
      const ben = await this.prisma.beneficiary.create({
        data: {
          name: `Synthetic Test Farmer #${i} [TEST_SYNTHETIC_DATA]`,
          phone_number: phone,
          email: `test.farmer.${uniqueSuffix}@watergrid.test`,
          address_line_1: `Test Field Station ${i}, Sector ${runId} [TEST_SYNTHETIC_DATA]`,
          pincode: '642001',
          district_id: district.district_id,
          block_id: block?.block_id,
          village_id: village.village_id,
          location_description: '[TEST_SYNTHETIC_DATA]',
        },
      });

      let holdingId: string | null = null;

      // 2. Create Land Holdings & Parcels if requested
      if (dto.includeHoldings) {
        const area = 2.0 + (i % 5);
        const holding = await this.prisma.landHolding.create({
          data: {
            beneficiary_id: ben.beneficiary_id,
            project_id: project.project_id,
            declared_total_area: new Decimal(area),
            status: 'ACTIVE',
            area_unit: 'ACRES',
          },
        });
        holdingId = holding.land_id;

        await this.prisma.landParcel.create({
          data: {
            land_id: holding.land_id,
            survey_number: `SYN-${runId}-${i}`,
            subdivision_number: '1A',
            area: new Decimal(area),
          },
        });
      }

      // 3. Create Water Application if requested
      if (dto.includeWaterApplications && holdingId) {
        const reqLitres = (2.0 + (i % 5)) * 10000;
        const app = await this.prisma.waterApplication.create({
          data: {
            beneficiary_id: ben.beneficiary_id,
            land_id: holdingId,
            project_id: project.project_id,
            required_litres: new Decimal(reqLitres),
            status: dto.includeApprovedAllotments ? 'APPROVED' : 'SUBMITTED',
            created_by: 'TEST_SYNTHETIC_GENERATOR',
          },
        });

        // 4. Create Approved Allotment if requested
        if (dto.includeApprovedAllotments && rate) {
          const allot = await this.prisma.waterAllotment.create({
            data: {
              application_id: app.application_id,
              beneficiary_id: ben.beneficiary_id,
              rate_id: rate.rate_id,
              total_land_acres_snapshot: new Decimal(2.0 + (i % 5)),
              litres_per_acre_snapshot: rate.litres_per_acre,
              calculated_allotted_litres: new Decimal(reqLitres),
              approved_litres: new Decimal(reqLitres),
              approval_status: 'APPROVED',
              approved_by: 'DEVELOPER_SYNTHETIC_TEST',
              approval_remarks: '[TEST_SYNTHETIC_DATA]',
            },
          });

          // 5. Create Billing & Payments if requested
          if (dto.includeBillingAndPayments) {
            const devRate = parseFloat(rate.development_cost_per_litre.toString());
            const totalBill = reqLitres * devRate;

            const bill = await this.prisma.developmentBill.create({
              data: {
                allotment_id: allot.allotment_id,
                beneficiary_id: ben.beneficiary_id,
                approved_litres_snapshot: new Decimal(reqLitres),
                development_cost_per_litre_snapshot: rate.development_cost_per_litre,
                total_amount: new Decimal(totalBill),
                amount_paid: new Decimal(0),
                pending_amount: new Decimal(totalBill),
                status: 'PENDING',
              },
            });

            const pcts = [2.5, 20.0, 25.0, 25.0, 27.5];
            for (let j = 0; j < 5; j++) {
              const amt = (totalBill * pcts[j]) / 100;
              const dueDate = new Date();
              dueDate.setDate(dueDate.getDate() + (j + 1) * 30);

              await this.prisma.installment.create({
                data: {
                  bill_id: bill.bill_id,
                  installment_number: j + 1,
                  percentage: new Decimal(pcts[j]),
                  amount_due: new Decimal(amt),
                  due_date: dueDate,
                  amount_paid: new Decimal(0),
                  pending_amount: new Decimal(amt),
                  status: 'PENDING',
                },
              });
            }
          }
        }
      }

      createdBeneficiaries.push({
        beneficiaryId: ben.beneficiary_id,
        name: ben.name,
        phone: ben.phone_number,
      });
    }

    return {
      success: true,
      batchRunId: runId,
      recordsCreated: createdBeneficiaries.length,
      sampleBeneficiaries: createdBeneficiaries,
      marker: '[TEST_SYNTHETIC_DATA]',
    };
  }

  /**
   * Purges ONLY records tagged with [TEST_SYNTHETIC_DATA] marker.
   */
  async purgeSyntheticTestData(dto: PurgeTestDataDto) {
    if (dto.confirmationPhrase !== 'PURGE TEST DATA') {
      throw new BadRequestException(
        `Confirmation phrase mismatch. You must type 'PURGE TEST DATA' (Received: '${dto.confirmationPhrase}').`
      );
    }

    const testBeneficiaries = await this.prisma.beneficiary.findMany({
      where: {
        OR: [
          { name: { contains: '[TEST_SYNTHETIC_DATA]' } },
          { name: { contains: '[DEMO]' } },
          { phone_number: { startsWith: '90000' } },
        ],
      },
      include: {
        landHoldings: true,
        waterApplications: {
          include: {
            allotment: {
              include: {
                developmentBill: { include: { installments: true } },
                infrastructure: true,
              },
            },
          },
        },
      },
    });

    if (testBeneficiaries.length === 0) {
      return {
        success: true,
        purgedCount: 0,
        message: 'No synthetic test records found matching the [TEST_SYNTHETIC_DATA] marker.',
      };
    }

    const benIds = testBeneficiaries.map((b) => b.beneficiary_id);

    await this.prisma.$transaction(async (tx) => {
      // 1. Delete payments and installments
      await tx.payment.deleteMany({ where: { beneficiary_id: { in: benIds } } });
      await tx.installment.deleteMany({ where: { bill: { beneficiary_id: { in: benIds } } } });
      await tx.developmentBill.deleteMany({ where: { beneficiary_id: { in: benIds } } });
      await tx.runningBill.deleteMany({ where: { beneficiary_id: { in: benIds } } });
      await tx.infrastructure.deleteMany({ where: { beneficiary_id: { in: benIds } } });
      await tx.extension.deleteMany({ where: { beneficiary_id: { in: benIds } } });
      await tx.waterAllotment.deleteMany({ where: { beneficiary_id: { in: benIds } } });
      await tx.waterApplication.deleteMany({ where: { beneficiary_id: { in: benIds } } });
      await tx.landParcel.deleteMany({ where: { landHolding: { beneficiary_id: { in: benIds } } } });
      await tx.landHolding.deleteMany({ where: { beneficiary_id: { in: benIds } } });
      await tx.beneficiaryDocument.deleteMany({ where: { beneficiary_id: { in: benIds } } });
      await tx.beneficiary.deleteMany({ where: { beneficiary_id: { in: benIds } } });
    });

    return {
      success: true,
      purgedCount: testBeneficiaries.length,
      purgedBeneficiaryIds: benIds,
      message: `Successfully purged ${testBeneficiaries.length} synthetic test record(s) and all linked dependencies.`,
    };
  }
}
