import { Test, TestingModule } from '@nestjs/testing';
import { FindFilterService } from './find-filter.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FindFilterDto, ReportingDateType } from './dto/find-filter.dto';
import {
  BeneficiaryStatus,
  LandStatus,
  ApplicationStatus,
  ApprovalStatus,
  BillStatus,
  InstallmentStatus,
  PaymentMode,
  InfrastructureStatus,
  ExtensionStatus,
} from '@prisma/client';
import { Decimal } from 'decimal.js';

describe('FindFilterService', () => {
  let service: FindFilterService;
  let prismaService: PrismaService;
  let auditService: AuditService;

  const mockPrismaService = {
    beneficiary: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    district: {
      findUnique: jest.fn(),
    },
    block: {
      findUnique: jest.fn(),
    },
    village: {
      findUnique: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FindFilterService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<FindFilterService>(FindFilterService);
    prismaService = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildBeneficiaryWhere', () => {
    it('should build where query for location filters (district, block, village)', () => {
      const dto: FindFilterDto = {
        districtId: 'dist-123',
        blockId: 'blk-456',
        villageId: 'vil-789',
      };
      const where = service.buildBeneficiaryWhere(dto);

      expect(where.AND).toEqual(
        expect.arrayContaining([
          { district_id: 'dist-123' },
          { block_id: 'blk-456' },
          { village_id: 'vil-789' },
        ]),
      );
    });

    it('should build case-insensitive search for beneficiary name and phone', () => {
      const dto: FindFilterDto = {
        beneficiaryName: 'Ravi',
        phoneNumber: '98765',
      };
      const where = service.buildBeneficiaryWhere(dto);

      expect(where.AND).toEqual(
        expect.arrayContaining([
          { name: { contains: 'Ravi', mode: 'insensitive' } },
          { phone_number: { contains: '98765' } },
        ]),
      );
    });

    it('should build land area min and max filters using Decimal comparisons', () => {
      const dto: FindFilterDto = {
        landAreaMin: 5,
        landAreaMax: 10,
        surveyNumber: 'SF101',
        subdivisionNumber: '2B',
      };
      const where = service.buildBeneficiaryWhere(dto);

      expect(where.AND).toBeDefined();
      const landCondition = (where.AND as any[])?.find((c: any) => c.landHoldings);
      expect(landCondition).toBeDefined();
    });

    it('should build water application & allotment filters', () => {
      const dto: FindFilterDto = {
        requiredLitresMin: 1000,
        requiredLitresMax: 5000,
        approvedLitresMin: 800,
        approvedLitresMax: 4000,
        applicationStatus: ApplicationStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
      };
      const where = service.buildBeneficiaryWhere(dto);

      expect(where.AND).toBeDefined();
      const appCondition = (where.AND as any[])?.find((c: any) => c.waterApplications);
      const allotCondition = (where.AND as any[])?.find((c: any) => c.waterAllotments);
      expect(appCondition).toBeDefined();
      expect(allotCondition).toBeDefined();
    });

    it('should build billing and installment filters', () => {
      const dto: FindFilterDto = {
        developmentBillStatus: BillStatus.PENDING,
        installmentNumber: 1,
        installmentStatus: InstallmentStatus.OVERDUE,
        paymentMode: PaymentMode.UPI,
      };
      const where = service.buildBeneficiaryWhere(dto);

      expect(where.AND).toBeDefined();
      const billCondition = (where.AND as any[])?.find((c: any) => c.developmentBills);
      const payCondition = (where.AND as any[])?.find((c: any) => c.payments);
      expect(billCondition).toBeDefined();
      expect(payCondition).toBeDefined();
    });

    it('should build infrastructure and extension filters', () => {
      const dto: FindFilterDto = {
        infrastructureStatus: InfrastructureStatus.COMMISSIONED,
        extensionStatus: ExtensionStatus.APPROVED,
        extensionLitresMin: 500,
      };
      const where = service.buildBeneficiaryWhere(dto);

      expect(where.AND).toBeDefined();
      const infraCondition = (where.AND as any[])?.find((c: any) => c.infrastructures);
      const extCondition = (where.AND as any[])?.find((c: any) => c.extensions);
      expect(infraCondition).toBeDefined();
      expect(extCondition).toBeDefined();
    });

    it('should build date range filters for different date types', () => {
      const dto: FindFilterDto = {
        dateType: ReportingDateType.APPLICATION_DATE,
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      };
      const where = service.buildBeneficiaryWhere(dto);
      expect(where.AND).toBeDefined();
      const appCondition = (where.AND as any[])?.find((c: any) => c.waterApplications);
      expect(appCondition).toBeDefined();
    });
  });

  describe('executeFilterQuery', () => {
    it('should calculate whole-dataset metrics without join multiplication and return paginated records', async () => {
      mockPrismaService.beneficiary.count.mockResolvedValue(1);
      mockPrismaService.beneficiary.findMany.mockResolvedValue([
        {
          beneficiary_id: 'ben-1',
          name: 'Kanishk Kumar',
          phone_number: '9876543210',
          status: BeneficiaryStatus.ACTIVE,
          district: { name: 'Kancheepuram' },
          block: { name: 'Kancheepuram' },
          village: { name: 'Angambakkam' },
          landHoldings: [
            {
              land_id: 'l-1',
              status: LandStatus.ACTIVE,
              declared_total_area: new Decimal('10.00'),
              parcels: [
                { parcel_id: 'p-1', area_acres: new Decimal('5.5') },
                { parcel_id: 'p-2', area_acres: new Decimal('4.5') },
              ],
            },
          ],
          waterApplications: [
            {
              application_id: 'wa-1',
              status: ApplicationStatus.APPROVED,
              created_at: new Date('2026-01-10'),
              required_litres: new Decimal('10000'),
            },
          ],
          waterAllotments: [
            {
              allotment_id: 'alt-1',
              calculated_allotted_litres: new Decimal('10000'),
              approved_litres: new Decimal('10000'),
              approval_status: ApprovalStatus.APPROVED,
              allotted_at: new Date('2026-01-15'),
              developmentBill: {
                bill_id: 'db-1',
                total_amount: new Decimal('20000'),
                amount_paid: new Decimal('6000'),
                pending_amount: new Decimal('14000'),
                status: BillStatus.PARTIALLY_PAID,
                installments: [
                  {
                    installment_id: 'ins-1',
                    installment_number: 1,
                    amount_due: new Decimal('4000'),
                    amount_paid: new Decimal('4000'),
                    pending_amount: new Decimal('0'),
                    status: InstallmentStatus.PAID,
                  },
                  {
                    installment_id: 'ins-2',
                    installment_number: 2,
                    amount_due: new Decimal('4000'),
                    amount_paid: new Decimal('2000'),
                    pending_amount: new Decimal('2000'),
                    status: InstallmentStatus.PARTIALLY_PAID,
                  },
                  {
                    installment_id: 'ins-3',
                    installment_number: 3,
                    amount_due: new Decimal('4000'),
                    amount_paid: new Decimal('0'),
                    pending_amount: new Decimal('4000'),
                    status: InstallmentStatus.PENDING,
                  },
                ],
              },
              infrastructure: {
                status: InfrastructureStatus.COMMISSIONED,
              },
            },
          ],
          developmentBills: [
            {
              bill_id: 'db-1',
              total_amount: new Decimal('20000'),
              amount_paid: new Decimal('6000'),
              pending_amount: new Decimal('14000'),
              status: BillStatus.PARTIALLY_PAID,
              installments: [
                {
                  installment_id: 'ins-1',
                  installment_number: 1,
                  amount_due: new Decimal('4000'),
                  amount_paid: new Decimal('4000'),
                  pending_amount: new Decimal('0'),
                  status: InstallmentStatus.PAID,
                },
                {
                  installment_id: 'ins-2',
                  installment_number: 2,
                  amount_due: new Decimal('4000'),
                  amount_paid: new Decimal('2000'),
                  pending_amount: new Decimal('2000'),
                  status: InstallmentStatus.PARTIALLY_PAID,
                },
              ],
            },
          ],
          infrastructures: [
            {
              infrastructure_id: 'ip-1',
              status: InfrastructureStatus.COMMISSIONED,
              commissioned_at: new Date('2026-03-01'),
            },
          ],
          extensions: [],
        },
      ]);

      const dto: FindFilterDto = { page: 1, limit: 50 };
      const result = await service.executeFilterQuery(dto, 'admin-user-id', '127.0.0.1');

      expect(result.meta.total).toBe(1);
      expect(result.metrics.beneficiaries.total).toBe(1);
      expect(result.metrics.beneficiaries.active).toBe(1);
      // Land area: 10.00 acres
      expect(result.metrics.land.totalLandAcres).toBe('10.0000');
      expect(result.metrics.land.totalHoldings).toBe(1);
      expect(result.metrics.land.totalParcels).toBe(2);
      // Water: 10,000 litres
      expect(result.metrics.water.totalRequiredLitres).toBe('10000.00');
      expect(result.metrics.water.totalApprovedLitres).toBe('10000.00');
      // Financials: Cost = 20000, Paid = 6000, Pending = 14000
      expect(result.metrics.financials.totalDevelopmentCost).toBe('20000.00');
      expect(result.metrics.financials.totalAmountPaid).toBe('6000.00');
      expect(result.metrics.financials.totalPending).toBe('14000.00');
      expect(result.metrics.paymentBeneficiaries.partiallyPaid).toBe(1);
      expect(result.metrics.infrastructure.commissioned).toBe(1);

      // Verify audit logging
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-user-id',
          entityType: 'FindFilterQuery',
        }),
      );
    });
  });

  describe('getFilterMetadata', () => {
    it('should return available enums and statuses', async () => {
      const meta = await service.getFilterMetadata();
      expect(meta.beneficiaryStatuses).toContain(BeneficiaryStatus.ACTIVE);
      expect(meta.paymentModes).toContain(PaymentMode.UPI);
      expect(meta.infrastructureStatuses).toContain(InfrastructureStatus.COMMISSIONED);
      expect(meta.dateTypes).toContain(ReportingDateType.APPLICATION_DATE);
    });
  });

  describe('generatePdfReport', () => {
    it('should generate a valid PDF buffer and metadata', async () => {
      mockPrismaService.beneficiary.count.mockResolvedValue(0);
      mockPrismaService.beneficiary.findMany.mockResolvedValue([]);

      const dto: FindFilterDto = {};
      const user = { user_id: 'admin-id', email: 'admin@water.gov', full_name: 'Admin User', role: 'ADMIN' };
      const pdf = await service.generatePdfReport(dto, user as any, '127.0.0.1');

      expect(pdf.buffer).toBeInstanceOf(Buffer);
      expect(pdf.buffer.length).toBeGreaterThan(0);
      expect(pdf.fileName).toContain('water-management-report');
      expect(pdf.recordCount).toBe(0);
    });
  });
});
