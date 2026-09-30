import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config();
process.env.DATABASE_URL = 'file:' + path.resolve(__dirname, '../prisma/template.db');

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/modules/common/filters/http-exception.filter';
import { TransformDecimalInterceptor } from '../src/modules/common/interceptors/transform-decimal.interceptor';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { PaymentMode } from '@prisma/client';

describe('Core Business Rules & Integrity Test Suite (Tests 1-12)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  let districtId: string;
  let blockId: string;
  let villageId: string;
  let projectId: string;
  const uid = Math.floor(1000 + Math.random() * 9000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformDecimalInterceptor());

    await app.init();
    prisma = app.get(PrismaService);

    // Login as Admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@water.gov', password: 'Admin@123456' });
    adminToken = adminRes.body.accessToken;

    // Get location hierarchy from database ensuring village belongs to block/district
    const v = await prisma.village.findFirst({
      include: { block: true, panchayat: true },
    });
    villageId = v.village_id;
    blockId = v.block_id || null;
    districtId = v.block?.district_id || (await prisma.district.findFirst()).district_id;

    // Get active project
    const p = await prisma.project.findFirst({ where: { status: 'ACTIVE' } });
    projectId = p ? p.project_id : (await prisma.project.findFirst()).project_id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Core Business Rule #1: One Water Application Per Land Holding', () => {
    let ben1Id: string;
    let holding1Id: string;
    let app1Id: string;

    it('TEST 1: 5-acre holding -> create water application -> success', async () => {
      // 1. Create Beneficiary
      const benRes = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test1 Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Field Plot 12, Main Road',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        })
        .expect(201);
      ben1Id = benRes.body.beneficiary_id;

      // 2. Add 5-acre land holding
      const landRes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben1Id,
          projectId,
          declaredTotalArea: 5.0,
          parcels: [{ surveyNumber: `S${uid}-101`, subdivisionNumber: '1A', area: 5.0 }],
        })
        .expect(201);
      holding1Id = landRes.body.land_id;

      // 3. Create Water Application for holding1
      const appRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben1Id,
          landId: holding1Id,
          projectId,
          requiredLitres: 50000,
          remarks: 'First application for holding 1',
        })
        .expect(201);

      expect(appRes.body.application_id).toBeDefined();
      expect(appRes.body.land_id).toBe(holding1Id);
      app1Id = appRes.body.application_id;
    });

    it('TEST 2: Same 5-acre holding -> attempt second application -> MUST FAIL (400 Conflict)', async () => {
      const duplicateRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben1Id,
          landId: holding1Id,
          projectId,
          requiredLitres: 50000,
          remarks: 'Duplicate attempt on holding 1',
        })
        .expect(400);

      const msg = Array.isArray(duplicateRes.body.message)
        ? duplicateRes.body.message.join(' ')
        : duplicateRes.body.message;
      expect(msg).toMatch(/already has an active water application/i);
    });

    it('TEST 3: 5-acre holding -> first application rejected -> new application allowed', async () => {
      // 1. Reject first application
      await request(app.getHttpServer())
        .post('/api/v1/water/applications/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicationId: app1Id,
          rejectionRemarks: 'Testing reapplication after rejection',
        })
        .expect(201);

      // 2. Submit new application for the same holding
      const newAppRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben1Id,
          landId: holding1Id,
          projectId,
          requiredLitres: 45000,
          remarks: 'Reapplication for holding 1 after rejection',
        })
        .expect(201);

      expect(newAppRes.body.application_id).toBeDefined();
      expect(newAppRes.body.land_id).toBe(holding1Id);
    });

    it('TEST 4: Beneficiary with Holding A (5 acres) & Holding B (3 acres) -> Create app for A and app for B -> Both succeed', async () => {
      // 1. Create Beneficiary 2
      const ben2Res = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'MultiHolding Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Plot 44, North Street',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        })
        .expect(201);
      const ben2Id = ben2Res.body.beneficiary_id;

      // 2. Add Holding A (5 acres)
      const landARes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben2Id,
          projectId,
          declaredTotalArea: 5.0,
          parcels: [{ surveyNumber: `S${uid}-201`, subdivisionNumber: 'A', area: 5.0 }],
        })
        .expect(201);
      const holdingAId = landARes.body.land_id;

      // 3. Add Holding B (3 acres)
      const landBRes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben2Id,
          projectId,
          declaredTotalArea: 3.0,
          parcels: [{ surveyNumber: `S${uid}-202`, subdivisionNumber: 'B', area: 3.0 }],
        })
        .expect(201);
      const holdingBId = landBRes.body.land_id;

      // 4. Create application for Holding A
      const appARes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben2Id,
          landId: holdingAId,
          projectId,
          requiredLitres: 50000,
        })
        .expect(201);

      // 5. Create application for Holding B
      const appBRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben2Id,
          landId: holdingBId,
          projectId,
          requiredLitres: 30000,
        })
        .expect(201);

      expect(appARes.body.land_id).toBe(holdingAId);
      expect(appBRes.body.land_id).toBe(holdingBId);
      expect(appARes.body.application_id).not.toBe(appBRes.body.application_id);
    });
  });

  describe('Historical Rates & Billing Snapshot Preservation (Tests 5-8)', () => {
    let benRateId: string;
    let holdingRateId: string;
    let appRateId: string;
    let billId: string;

    it('TEST 5 & 6 & 7: Historical rate preserved across rate updates, dev bill calculation locked', async () => {
      // 1. Beneficiary & Land Holding
      const benRes = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'RateSnapshot Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Plot 77, East Street',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        })
        .expect(201);
      benRateId = benRes.body.beneficiary_id;

      const landRes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benRateId,
          projectId,
          declaredTotalArea: 5.0,
          parcels: [{ surveyNumber: `S${uid}-301`, subdivisionNumber: 'A', area: 5.0 }],
        })
        .expect(201);
      holdingRateId = landRes.body.land_id;

      // 2. Create Application with active rate (50,000 L)
      const appRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benRateId,
          landId: holdingRateId,
          projectId,
          requiredLitres: 50000,
        })
        .expect(201);
      appRateId = appRes.body.application_id;

      // 3. Approve application -> generates WaterAllotment & DevelopmentBill
      const approveRes = await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicationId: appRateId,
          approvedLitres: 50000,
          approvalRemarks: 'Approved 50k L allotment',
        })
        .expect(201);

      billId = approveRes.body.developmentBill.bill_id;

      const originalBill = approveRes.body.developmentBill;
      const originalTotalAmount = parseFloat(originalBill.total_amount);
      const originalDevRate = parseFloat(originalBill.development_cost_per_litre_snapshot);

      // TEST 7: Development bill calculation = approved litres * historical development rate
      expect(originalTotalAmount).toBeCloseTo(50000 * originalDevRate, 2);

      // 4. Update Rate Configuration for project to a new rate
      await request(app.getHttpServer())
        .post('/api/v1/rates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          effectiveFrom: new Date().toISOString(),
          litresPerAcre: 12000,
          developmentCostPerLitre: 1.50,
          runningCostPerLitre: 0.20,
          reason: 'Rate revision test',
        })
        .expect(201);

      // TEST 5: Verify Old application still retains historical rate & volume
      const loadedApp = await prisma.waterApplication.findUnique({
        where: { application_id: appRateId },
      });
      expect(loadedApp.required_litres.toString()).toBe('50000');

      // TEST 6: Verify Development Bill was NOT mutated by the new rate
      const loadedBill = await prisma.developmentBill.findUnique({
        where: { bill_id: billId },
      });
      expect(parseFloat(loadedBill.total_amount.toString())).toBe(originalTotalAmount);
      expect(parseFloat(loadedBill.development_cost_per_litre_snapshot.toString())).toBe(originalDevRate);
    });

    it('TEST 8: Installments must total exactly 100% and equal the development bill total', async () => {
      const installments = await prisma.installment.findMany({
        where: { bill_id: billId },
        orderBy: { installment_number: 'asc' },
      });

      expect(installments).toHaveLength(5);

      const totalPct = installments.reduce((acc, inst) => acc + parseFloat(inst.percentage.toString()), 0);
      expect(totalPct).toBeCloseTo(100.0, 4);

      const totalDue = installments.reduce((acc, inst) => acc + parseFloat(inst.amount_due.toString()), 0);
      const bill = await prisma.developmentBill.findUnique({ where: { bill_id: billId } });
      expect(totalDue).toBeCloseTo(parseFloat(bill.total_amount.toString()), 2);

      // Reset baseline rate configuration
      await prisma.rateConfiguration.updateMany({
        where: { project_id: projectId },
        data: { is_active: false },
      });
      await prisma.rateConfiguration.create({
        data: {
          project_id: projectId,
          litres_per_acre: 10000,
          development_cost_per_litre: 2.0,
          running_cost_per_litre: 0.5,
          effective_from: new Date(),
          is_active: true,
          created_by: 'admin@water.gov',
        },
      });
    });
  });

  describe('Financial Ledger, Verification & Aggregations (Tests 9-12)', () => {
    let benFinId: string;
    let billFinId: string;
    let inst1Id: string;

    it('TEST 9: Payment of installment must increase Total Paid and decrease Balance Pending', async () => {
      // 1. Create Beneficiary
      const benRes = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Finance Audit Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Plot 99, South Street',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        })
        .expect(201);
      benFinId = benRes.body.beneficiary_id;

      const landRes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benFinId,
          projectId,
          declaredTotalArea: 5.0,
          parcels: [{ surveyNumber: `S${uid}-401`, subdivisionNumber: 'A', area: 5.0 }],
        })
        .expect(201);

      const appRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benFinId,
          landId: landRes.body.land_id,
          projectId,
          requiredLitres: 50000,
        })
        .expect(201);

      const approveRes = await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicationId: appRes.body.application_id,
          approvedLitres: 50000,
        })
        .expect(201);

      billFinId = approveRes.body.developmentBill.bill_id;
      const inst = await prisma.installment.findFirst({
        where: { bill_id: billFinId, installment_number: 1 },
      });
      inst1Id = inst.installment_id;

      const beforeBill = await prisma.developmentBill.findUnique({ where: { bill_id: billFinId } });
      const inst1 = await prisma.installment.findUnique({ where: { installment_id: inst1Id } });
      const payAmount = parseFloat(inst1.amount_due.toString());

      // Make Payment
      const payRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benFinId,
          installmentId: inst1Id,
          amount: payAmount,
          paymentMode: PaymentMode.UPI,
          paymentReference: 'UPI-TEST-12345',
        })
        .expect(201);

      expect(payRes.body.payment_id).toBeDefined();

      const afterBill = await prisma.developmentBill.findUnique({ where: { bill_id: billFinId } });
      expect(parseFloat(afterBill.amount_paid.toString())).toBeCloseTo(payAmount, 2);
      expect(parseFloat(afterBill.pending_amount.toString())).toBeCloseTo(
        parseFloat(beforeBill.pending_amount.toString()) - payAmount,
        2,
      );
    });

    it('TEST 10: Cancelled/reversed payment must NOT remain in Total Paid', async () => {
      const payment = await prisma.payment.findFirst({
        where: { beneficiary_id: benFinId },
      });

      // Reverse Payment
      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.payment_id}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test reversal audit check' })
        .expect(201);

      const billAfterReversal = await prisma.developmentBill.findUnique({ where: { bill_id: billFinId } });
      expect(parseFloat(billAfterReversal.amount_paid.toString())).toBeCloseTo(0, 2);
      expect(parseFloat(billAfterReversal.pending_amount.toString())).toBeCloseTo(
        parseFloat(billAfterReversal.total_amount.toString()),
        2,
      );
    });

    it('TEST 11: Dashboard water totals must aggregate distinctly without duplicate join multiplication', async () => {
      const dossierRes = await request(app.getHttpServer())
        .get(`/api/v1/beneficiaries/${benFinId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dossier = dossierRes.body;

      const totalRequired = dossier.waterApplications?.reduce(
        (acc: number, curr: any) => acc + (parseFloat(curr.required_litres) || 0),
        0,
      );
      const totalApproved = dossier.waterAllotments?.reduce(
        (acc: number, curr: any) => acc + (parseFloat(curr.approved_litres) || 0),
        0,
      );

      expect(totalRequired).toBe(50000);
      expect(totalApproved).toBe(50000);
    });

    it('TEST 12: Same holding cannot contribute water allocation twice', async () => {
      const holdings = await prisma.landHolding.findMany({
        where: { beneficiary_id: benFinId, status: 'ACTIVE' },
        include: { waterApplications: { where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] } } } },
      });

      for (const h of holdings) {
        expect(h.waterApplications.length).toBeLessThanOrEqual(1);
      }
    });
  });
});
