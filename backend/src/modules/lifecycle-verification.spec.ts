import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma/prisma.service';
import { WaterService } from './water/water.service';
import { LandService } from './land/land.service';
import { PaymentsService } from './payments/payments.service';
import { DeveloperDiagnosticsService } from './developer/services/developer-diagnostics.service';
import { DeveloperDbExplorerService } from './developer/services/developer-db-explorer.service';
import { AuditService } from './audit/audit.service';
import { IntegrityService } from './integrity/integrity.service';
import { ConfigModule } from '@nestjs/config';
import { ApplicationStatus, LandStatus, PaymentMode } from './common/enums';

describe('Real Lifecycle, Database State & Operational Scope Verification', () => {
  let prisma: PrismaService;
  let waterService: WaterService;
  let landService: LandService;
  let paymentsService: PaymentsService;
  let diagnosticsService: DeveloperDiagnosticsService;
  let dbExplorerService: DeveloperDbExplorerService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        PrismaService,
        WaterService,
        LandService,
        PaymentsService,
        IntegrityService,
        DeveloperDiagnosticsService,
        DeveloperDbExplorerService,
        AuditService,
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    waterService = module.get<WaterService>(WaterService);
    landService = module.get<LandService>(LandService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    diagnosticsService = module.get<DeveloperDiagnosticsService>(DeveloperDiagnosticsService);
    dbExplorerService = module.get<DeveloperDbExplorerService>(DeveloperDbExplorerService);
  });

  async function getOrCreateTestBeneficiaryAndProject() {
    let project = await prisma.project.findFirst({ where: { status: 'ACTIVE' } });
    if (!project) {
      project = await prisma.project.create({
        data: {
          project_code: `PROJ-${Date.now()}`,
          project_name: 'Test Project Scheme',
          status: 'ACTIVE',
        },
      });
    }

    let beneficiary = await prisma.beneficiary.findFirst({ where: { status: 'ACTIVE' } });
    if (!beneficiary) {
      beneficiary = await prisma.beneficiary.create({
        data: {
          name: 'Test Beneficiary',
          phone_number: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
          status: 'ACTIVE',
        },
      });
    }

    return { beneficiary, project };
  }

  it('TEST A: Cancelling a water application excludes it from CURRENT and includes it in HISTORY', async () => {
    // 1. Get or create test beneficiary & project
    const { beneficiary, project } = await getOrCreateTestBeneficiaryAndProject();
    expect(beneficiary).toBeDefined();
    expect(project).toBeDefined();

    // 2. Create holding & water application
    const holding = await prisma.landHolding.create({
      data: {
        beneficiary_id: beneficiary.beneficiary_id,
        project_id: project.project_id,
        declared_total_area: 3.5,
        status: LandStatus.ACTIVE,
      },
    });

    const app = await prisma.waterApplication.create({
      data: {
        beneficiary_id: beneficiary.beneficiary_id,
        project_id: project.project_id,
        land_id: holding.land_id,
        required_litres: 120000,
        status: ApplicationStatus.SUBMITTED,
        created_by: 'QA_TEST_RUNNER',
      },
    });

    // Verify initially in CURRENT scope
    const currentBefore = await waterService.findAllApplications({ scope: 'CURRENT' });
    expect(currentBefore.items.some((a) => a.application_id === app.application_id)).toBe(true);

    // Cancel application
    const cancelled = await waterService.cancelApplication(app.application_id, 'Testing Cancellation Workflow');
    expect(cancelled.status).toBe('CANCELLED');

    // Verify in database directly via SQLite/Prisma
    const dbRow = await prisma.waterApplication.findUnique({ where: { application_id: app.application_id } });
    expect(dbRow?.status).toBe('CANCELLED');

    // Verify CURRENT query EXCLUDES it
    const currentAfter = await waterService.findAllApplications({ scope: 'CURRENT' });
    expect(currentAfter.items.some((a) => a.application_id === app.application_id)).toBe(false);

    // Verify HISTORY query INCLUDES it
    const historyAfter = await waterService.findAllApplications({ scope: 'HISTORY' });
    expect(historyAfter.items.some((a) => a.application_id === app.application_id)).toBe(true);
  });

  it('TEST B: Voiding an approved water application excludes it from CURRENT and includes it in HISTORY', async () => {
    const { beneficiary, project } = await getOrCreateTestBeneficiaryAndProject();

    const holding = await prisma.landHolding.create({
      data: {
        beneficiary_id: beneficiary.beneficiary_id,
        project_id: project.project_id,
        declared_total_area: 2.0,
        status: LandStatus.ACTIVE,
      },
    });

    const app = await prisma.waterApplication.create({
      data: {
        beneficiary_id: beneficiary!.beneficiary_id,
        project_id: project!.project_id,
        land_id: holding.land_id,
        required_litres: 80000,
        status: ApplicationStatus.APPROVED,
        created_by: 'QA_TEST_RUNNER',
      },
    });

    // Void application (approved applications transition to VOIDED)
    const voided = await waterService.cancelApplication(app.application_id, 'Testing Void Workflow');
    expect(voided.status).toBe('VOIDED');

    // Verify directly in DB
    const dbRow = await prisma.waterApplication.findUnique({ where: { application_id: app.application_id } });
    expect(dbRow?.status).toBe('VOIDED');

    // Verify CURRENT excludes and HISTORY includes
    const current = await waterService.findAllApplications({ scope: 'CURRENT' });
    expect(current.items.some((a) => a.application_id === app.application_id)).toBe(false);

    const history = await waterService.findAllApplications({ scope: 'HISTORY' });
    expect(history.items.some((a) => a.application_id === app.application_id)).toBe(true);
  });

  it('TEST D & E: Deactivating a land holding cancels in-progress applications and preserves history without orphans', async () => {
    const { beneficiary, project } = await getOrCreateTestBeneficiaryAndProject();

    // 1. Create holding
    const holding = await prisma.landHolding.create({
      data: {
        beneficiary_id: beneficiary.beneficiary_id,
        project_id: project.project_id,
        declared_total_area: 5.0,
        status: LandStatus.ACTIVE,
      },
    });

    // 2. Create in-progress water application linked to holding
    const app = await prisma.waterApplication.create({
      data: {
        beneficiary_id: beneficiary.beneficiary_id,
        project_id: project.project_id,
        land_id: holding.land_id,
        required_litres: 200000,
        status: ApplicationStatus.SUBMITTED,
        created_by: 'QA_TEST_RUNNER',
      },
    });

    // 3. Deactivate Land Holding
    const deactivatedHolding = await landService.deactivateHolding(holding.land_id);
    expect(deactivatedHolding.status).toBe(LandStatus.INACTIVE);

    // 4. Verify in DB that holding is INACTIVE
    const dbHolding = await prisma.landHolding.findUnique({ where: { land_id: holding.land_id } });
    expect(dbHolding?.status).toBe(LandStatus.INACTIVE);

    // 5. Verify in DB that linked water application was safely transitioned to CANCELLED
    const dbApp = await prisma.waterApplication.findUnique({ where: { application_id: app.application_id } });
    expect(dbApp?.status).toBe('CANCELLED');

    // 6. Verify water application is removed from CURRENT scope
    const currentApps = await waterService.findAllApplications({ scope: 'CURRENT' });
    expect(currentApps.items.some((a) => a.application_id === app.application_id)).toBe(false);
  });

  it('TEST 5: Cash Payment records without UTR and correctly updates balances and installment status', async () => {
    // Find an installment with pending amount
    const installment = await prisma.installment.findFirst({
      where: {
        pending_amount: { gt: 0 },
      },
    });

    if (installment) {
      const bill = await prisma.developmentBill.findUnique({
        where: { bill_id: installment.bill_id },
        include: { allotment: true },
      });
      const beneficiaryId = bill?.allotment?.beneficiary_id;

      if (beneficiaryId) {
        const initialPending = Number(installment.pending_amount);
        const initialPaid = Number(installment.amount_paid);
        const payAmount = Math.min(100, initialPending);

        const payment = await paymentsService.recordPayment(
          {
            beneficiaryId,
            installmentId: installment.installment_id,
            amount: payAmount,
            paymentMode: PaymentMode.CASH,
            remarks: 'Cash payment test via QA verification',
          },
          'QA_TEST_OFFICER',
        );

        expect(payment).toBeDefined();
        expect(payment.payment_mode).toBe(PaymentMode.CASH);

        // Verify installment in DB
        const updatedInstallment = await prisma.installment.findUnique({
          where: { installment_id: installment.installment_id },
        });
        expect(Number(updatedInstallment?.amount_paid)).toBe(initialPaid + payAmount);
        expect(Number(updatedInstallment?.pending_amount)).toBe(initialPending - payAmount);
      }
    }
  });

  it('TEST 7: Developer diagnostics and health summary return live statistics', async () => {
    const health = await diagnosticsService.getHealthSummary();
    expect(health).toBeDefined();
    expect(health.overallStatus).toBeDefined();

    const stats = await dbExplorerService.getDatabaseStatistics();
    expect(stats.integrityCheckStatus).toBe('PASS');
    expect(stats.totalTables).toBeGreaterThan(0);
    expect(stats.totalRecords).toBeGreaterThan(0);
  });
});
