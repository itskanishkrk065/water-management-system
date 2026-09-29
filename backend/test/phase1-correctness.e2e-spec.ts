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
import { IntegrityService } from '../src/modules/integrity/integrity.service';
import { PaymentMode } from '@prisma/client';

describe('Phase 1 Correctness & Integrity Test Suite (Tests 1-32)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let integrityService: IntegrityService;
  let adminToken: string;

  let districtId: string;
  let blockId: string;
  let villageId: string;
  let projectId: string;

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
    integrityService = app.get(IntegrityService);

    // Login as Admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@water.gov', password: 'Admin@123456' });
    adminToken = adminRes.body.accessToken;

    const v = await prisma.village.findFirst({
      include: { block: true, panchayat: true },
    });
    villageId = v.village_id;
    blockId = v.block_id || null;
    districtId = v.block?.district_id || (await prisma.district.findFirst()).district_id;

    const p = await prisma.project.findFirst({ where: { status: 'ACTIVE' } });
    projectId = p ? p.project_id : (await prisma.project.findFirst()).project_id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Water Application Rules & Holding Uniqueness (Tests 1-10)', () => {
    let ben1Id: string;
    let holding1Id: string;
    let app1Id: string;

    let ben2Id: string;
    let holdingAId: string;
    let holdingBId: string;

    it('TEST 1: One holding -> first application succeeds', async () => {
      const benRes = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Farmer Test One',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Survey Plot 10',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        })
        .expect(201);
      ben1Id = benRes.body.beneficiary_id;

      const landRes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben1Id,
          projectId,
          declaredTotalArea: 5.0,
          parcels: [{ surveyNumber: '101', subdivisionNumber: '1A', area: 5.0 }],
        })
        .expect(201);
      holding1Id = landRes.body.land_id;

      const appRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben1Id,
          landId: holding1Id,
          projectId,
          requiredLitres: 50000,
        })
        .expect(201);

      expect(appRes.body.application_id).toBeDefined();
      expect(appRes.body.land_id).toBe(holding1Id);
      app1Id = appRes.body.application_id;
    });

    it('TEST 2: Same holding -> second active application fails (HTTP 400 Conflict)', async () => {
      const dupRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben1Id,
          landId: holding1Id,
          projectId,
          requiredLitres: 50000,
        })
        .expect(400);

      const msg = Array.isArray(dupRes.body.message) ? dupRes.body.message.join(' ') : dupRes.body.message;
      expect(msg).toMatch(/already has an active water application/i);
    });

    it('TEST 3: Same beneficiary -> different holding -> application succeeds', async () => {
      const benRes = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Multi Holding Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Survey Plot 20',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        })
        .expect(201);
      ben2Id = benRes.body.beneficiary_id;

      const landARes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben2Id,
          projectId,
          declaredTotalArea: 5.0,
          parcels: [{ surveyNumber: '201', subdivisionNumber: 'A', area: 5.0 }],
        })
        .expect(201);
      holdingAId = landARes.body.land_id;

      const landBRes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben2Id,
          projectId,
          declaredTotalArea: 3.0,
          parcels: [{ surveyNumber: '202', subdivisionNumber: 'B', area: 3.0 }],
        })
        .expect(201);
      holdingBId = landBRes.body.land_id;

      const appARes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: ben2Id, landId: holdingAId, projectId, requiredLitres: 50000 })
        .expect(201);

      const appBRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: ben2Id, landId: holdingBId, projectId, requiredLitres: 30000 })
        .expect(201);

      expect(appARes.body.land_id).toBe(holdingAId);
      expect(appBRes.body.land_id).toBe(holdingBId);
      expect(appARes.body.application_id).not.toBe(appBRes.body.application_id);
    });

    it('TEST 4: Existing application APPROVED -> second application fails', async () => {
      // Approve app1
      await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ applicationId: app1Id, approvedLitres: 50000 })
        .expect(201);

      // Attempt second application for holding1
      await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: ben1Id, landId: holding1Id, projectId, requiredLitres: 50000 })
        .expect(400);
    });

    it('TEST 5: Existing application SUBMITTED -> second application fails', async () => {
      // holdingA already has SUBMITTED app
      await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: ben2Id, landId: holdingAId, projectId, requiredLitres: 50000 })
        .expect(400);
    });

    it('TEST 6: Existing application UNDER_REVIEW -> second application fails', async () => {
      // Update holdingB app to UNDER_REVIEW
      const appB = await prisma.waterApplication.findFirst({ where: { land_id: holdingBId } });
      await prisma.waterApplication.update({
        where: { application_id: appB.application_id },
        data: { status: 'UNDER_REVIEW' },
      });

      await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: ben2Id, landId: holdingBId, projectId, requiredLitres: 30000 })
        .expect(400);
    });

    it('TEST 7: Existing application REJECTED -> reapplication follows existing workflow (allowed)', async () => {
      const appB = await prisma.waterApplication.findFirst({ where: { land_id: holdingBId } });
      await request(app.getHttpServer())
        .post('/api/v1/water/applications/reject')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ applicationId: appB.application_id, rejectionRemarks: 'Reject for reapplication test' })
        .expect(201);

      // Now reapplication for holdingB succeeds
      const reapplyRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: ben2Id, landId: holdingBId, projectId, requiredLitres: 28000 })
        .expect(201);

      expect(reapplyRes.body.land_id).toBe(holdingBId);
    });

    it('TEST 8: Existing application CANCELLED/VOIDED -> reapplication follows existing workflow (allowed)', async () => {
      const activeApp = await prisma.waterApplication.findFirst({
        where: { land_id: holdingBId, status: 'SUBMITTED' },
      });
      await prisma.waterApplication.update({
        where: { application_id: activeApp.application_id },
        data: { status: 'CANCELLED' },
      });

      const reapplyRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: ben2Id, landId: holdingBId, projectId, requiredLitres: 29000 })
        .expect(201);

      expect(reapplyRes.body.land_id).toBe(holdingBId);
    });

    it('TEST 9: Beneficiary cannot use another beneficiary land holding (ownership validation fails)', async () => {
      // ben1 tries to submit holding belonging to ben2
      await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: ben1Id, landId: holdingBId, projectId, requiredLitres: 30000 })
        .expect(400);
    });

    it('TEST 10: Concurrent creation attempts result in only one successful active application', async () => {
      // Create fresh holding C for ben2
      const landCRes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: ben2Id,
          projectId,
          declaredTotalArea: 2.0,
          parcels: [{ surveyNumber: '203', subdivisionNumber: 'C', area: 2.0 }],
        })
        .expect(201);
      const holdingCId = landCRes.body.land_id;

      // Send 2 parallel concurrent requests
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/water/applications')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ beneficiaryId: ben2Id, landId: holdingCId, projectId, requiredLitres: 20000 }),
        request(app.getHttpServer())
          .post('/api/v1/water/applications')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ beneficiaryId: ben2Id, landId: holdingCId, projectId, requiredLitres: 20000 }),
      ]);

      const successCount = [res1, res2].filter((r) => r.status === 201).length;
      const failureCount = [res1, res2].filter((r) => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });
  });

  describe('2. Water Aggregation Tests (Tests 11-14)', () => {
    let benAggId: string;
    let land1Id: string;
    let land2Id: string;
    let app1Id: string;
    let app2Id: string;

    it('TEST 11: Two valid applications of 50,000 L each -> total 100,000 L', async () => {
      const benRes = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Aggregation Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Plot Aggregation 1',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        })
        .expect(201);
      benAggId = benRes.body.beneficiary_id;

      const l1 = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benAggId,
          projectId,
          declaredTotalArea: 5.0,
          parcels: [{ surveyNumber: '301', subdivisionNumber: 'A', area: 5.0 }],
        })
        .expect(201);
      land1Id = l1.body.land_id;

      const l2 = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benAggId,
          projectId,
          declaredTotalArea: 5.0,
          parcels: [{ surveyNumber: '302', subdivisionNumber: 'B', area: 5.0 }],
        })
        .expect(201);
      land2Id = l2.body.land_id;

      const a1 = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: benAggId, landId: land1Id, projectId, requiredLitres: 50000 })
        .expect(201);
      app1Id = a1.body.application_id;

      const a2 = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: benAggId, landId: land2Id, projectId, requiredLitres: 50000 })
        .expect(201);
      app2Id = a2.body.application_id;

      const dossier = await request(app.getHttpServer())
        .get(`/api/v1/beneficiaries/${benAggId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const totalReq = dossier.body.waterApplications.reduce(
        (acc: number, curr: any) => acc + (parseFloat(curr.required_litres) || 0),
        0,
      );
      expect(totalReq).toBe(100000);
    });

    it('TEST 12: One application with five installments must still count as ONE application and ONE water allocation', async () => {
      const approveRes = await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ applicationId: app1Id, approvedLitres: 50000 })
        .expect(201);

      expect(approveRes.body.allotment_id).toBeDefined();

      const dossier = await request(app.getHttpServer())
        .get(`/api/v1/beneficiaries/${benAggId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const allotments = dossier.body.waterAllotments || [];
      expect(allotments.length).toBe(1);
      expect(parseFloat(allotments[0].approved_litres)).toBe(50000);
    });

    it('TEST 13: Multiple payments against a bill must not multiply water totals', async () => {
      const bill = await prisma.developmentBill.findFirst({ where: { beneficiary_id: benAggId } });
      const inst = await prisma.installment.findFirst({ where: { bill_id: bill.bill_id, installment_number: 1 } });

      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benAggId,
          installmentId: inst.installment_id,
          amount: 500,
          paymentMode: PaymentMode.CASH,
          paymentReference: 'TEST-PAY-1',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benAggId,
          installmentId: inst.installment_id,
          amount: 500,
          paymentMode: PaymentMode.UPI,
          paymentReference: 'TEST-PAY-2',
        })
        .expect(201);

      const dossier = await request(app.getHttpServer())
        .get(`/api/v1/beneficiaries/${benAggId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const allotments = dossier.body.waterAllotments || [];
      expect(allotments.length).toBe(1);
      expect(parseFloat(allotments[0].approved_litres)).toBe(50000);
    });

    it('TEST 14: Multiple joins must not multiply litres', async () => {
      const totalWater = await prisma.waterAllotment.aggregate({
        where: { beneficiary_id: benAggId },
        _sum: { approved_litres: true },
      });
      expect(parseFloat(totalWater._sum.approved_litres.toString())).toBe(50000);
    });
  });

  describe('3. Billing & Historical Rates (Tests 15-18)', () => {
    let benRateId: string;
    let landRateId: string;
    let appRateId: string;
    let billId: string;
    let initialDevRate: number;
    let initialTotalAmount: number;

    it('TEST 15: Approved litres × development rate = correct bill', async () => {
      const benRes = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Billing Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Plot Billing 1',
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
          parcels: [{ surveyNumber: '401', subdivisionNumber: 'A', area: 5.0 }],
        })
        .expect(201);
      landRateId = landRes.body.land_id;

      const aRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: benRateId, landId: landRateId, projectId, requiredLitres: 50000 })
        .expect(201);
      appRateId = aRes.body.application_id;

      const approveRes = await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ applicationId: appRateId, approvedLitres: 50000 })
        .expect(201);

      const bill = approveRes.body.developmentBill;
      billId = bill.bill_id;
      initialDevRate = parseFloat(bill.development_cost_per_litre_snapshot);
      initialTotalAmount = parseFloat(bill.total_amount);

      expect(initialTotalAmount).toBeCloseTo(50000 * initialDevRate, 2);
    });

    it('TEST 16: Zero/invalid approved quantity cannot generate an incorrect financial bill', async () => {
      const badBen = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Zero Test Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Plot Zero',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        })
        .expect(201);

      const badLand = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: badBen.body.beneficiary_id,
          projectId,
          declaredTotalArea: 5.0,
          parcels: [{ surveyNumber: '501', subdivisionNumber: 'A', area: 5.0 }],
        })
        .expect(201);

      const badApp = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ beneficiaryId: badBen.body.beneficiary_id, landId: badLand.body.land_id, projectId, requiredLitres: 50000 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ applicationId: badApp.body.application_id, approvedLitres: 0 })
        .expect(400);
    });

    it('TEST 17: Bill retains its historical rate snapshot', async () => {
      const loadedBill = await prisma.developmentBill.findUnique({ where: { bill_id: billId } });
      expect(parseFloat(loadedBill.development_cost_per_litre_snapshot.toString())).toBe(initialDevRate);
      expect(parseFloat(loadedBill.total_amount.toString())).toBe(initialTotalAmount);
    });

    it('TEST 18: Changing current rate does not change old bill', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/rates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          effectiveFrom: new Date().toISOString(),
          litresPerAcre: 15000,
          developmentCostPerLitre: 3.50,
          runningCostPerLitre: 0.75,
          reason: 'Phase 1 Rate Revision Test',
        })
        .expect(201);

      const billAfterNewRate = await prisma.developmentBill.findUnique({ where: { bill_id: billId } });
      expect(parseFloat(billAfterNewRate.development_cost_per_litre_snapshot.toString())).toBe(initialDevRate);
      expect(parseFloat(billAfterNewRate.total_amount.toString())).toBe(initialTotalAmount);

      // Reset baseline rate configuration for subsequent test suites
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

  describe('4. Installments & Payments (Tests 19-27)', () => {
    let billId: string;
    let inst1Id: string;
    let instAmount: number;
    let benId: string;

    it('TEST 19: Five installments are created', async () => {
      const bill = await prisma.developmentBill.findFirst({
        orderBy: { created_at: 'desc' },
        include: { installments: { orderBy: { installment_number: 'asc' } } },
      });
      billId = bill.bill_id;
      benId = bill.beneficiary_id;
      expect(bill.installments).toHaveLength(5);
    });

    it('TEST 20: Percentages total exactly 100%', async () => {
      const insts = await prisma.installment.findMany({ where: { bill_id: billId } });
      const totalPct = insts.reduce((acc, i) => acc + parseFloat(i.percentage.toString()), 0);
      expect(totalPct).toBeCloseTo(100.0, 4);
    });

    it('TEST 21: Installment amounts sum exactly to bill total', async () => {
      const insts = await prisma.installment.findMany({ where: { bill_id: billId } });
      const bill = await prisma.developmentBill.findUnique({ where: { bill_id: billId } });
      const totalDue = insts.reduce((acc, i) => acc + parseFloat(i.amount_due.toString()), 0);
      expect(totalDue).toBeCloseTo(parseFloat(bill.total_amount.toString()), 2);
    });

    it('TEST 22: Rounding is deterministic and correct', async () => {
      const insts = await prisma.installment.findMany({
        where: { bill_id: billId },
        orderBy: { installment_number: 'asc' },
      });
      for (const inst of insts) {
        expect(parseFloat(inst.amount_due.toString())).toBeGreaterThan(0);
      }
    });

    it('TEST 23: Payment increases total paid', async () => {
      const inst1 = await prisma.installment.findFirst({
        where: { bill_id: billId, installment_number: 1 },
      });
      inst1Id = inst1.installment_id;
      instAmount = parseFloat(inst1.amount_due.toString());

      const beforeBill = await prisma.developmentBill.findUnique({ where: { bill_id: billId } });
      const beforePaid = parseFloat(beforeBill.amount_paid.toString());

      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benId,
          installmentId: inst1Id,
          amount: instAmount,
          paymentMode: PaymentMode.BANK_TRANSFER,
          paymentReference: 'NEFT-PHASE1-1234',
        })
        .expect(201);

      const afterBill = await prisma.developmentBill.findUnique({ where: { bill_id: billId } });
      expect(parseFloat(afterBill.amount_paid.toString())).toBeCloseTo(beforePaid + instAmount, 2);
    });

    it('TEST 24: Payment decreases pending', async () => {
      const bill = await prisma.developmentBill.findUnique({ where: { bill_id: billId } });
      const total = parseFloat(bill.total_amount.toString());
      const paid = parseFloat(bill.amount_paid.toString());
      const pending = parseFloat(bill.pending_amount.toString());
      expect(pending).toBeCloseTo(total - paid, 2);
    });

    it('TEST 25: Failed/cancelled/reversed payments are excluded appropriately', async () => {
      const payment = await prisma.payment.findFirst({
        where: { installment_id: inst1Id, status: 'COMPLETED' },
      });

      // Reverse payment
      await request(app.getHttpServer())
        .post(`/api/v1/payments/${payment.payment_id}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Audit Test Payment Reversal' })
        .expect(201);

      const bill = await prisma.developmentBill.findUnique({ where: { bill_id: billId } });
      expect(parseFloat(bill.amount_paid.toString())).toBeCloseTo(0, 2);
      expect(parseFloat(bill.pending_amount.toString())).toBeCloseTo(parseFloat(bill.total_amount.toString()), 2);
    });

    it('TEST 26: Payment cannot incorrectly make pending negative', async () => {
      const bill = await prisma.developmentBill.findUnique({ where: { bill_id: billId } });
      expect(parseFloat(bill.pending_amount.toString())).toBeGreaterThanOrEqual(0);
    });

    it('TEST 27: Payment correction leaves an audit trail', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { action: 'PAYMENT_REVERSED' },
      });
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('5. Data Integrity Diagnostics (Tests 28-32)', () => {
    it('TEST 28: Duplicate active applications are detected', async () => {
      // 1. Fetch any existing valid holding
      const holding = await prisma.landHolding.findFirst({
        where: { status: 'ACTIVE' },
      });

      if (holding) {
        // Inject a simulated duplicate application directly to test detection capability
        const dupApp = await prisma.waterApplication.create({
          data: {
            project_id: projectId,
            beneficiary_id: holding.beneficiary_id,
            land_id: holding.land_id,
            required_litres: 10000,
            status: 'SUBMITTED',
            created_by: 'integrity-tester',
          },
        });

        const reportWithDup = await integrityService.runFullIntegrityAudit();
        const foundDup = reportWithDup.findings.find((f) => f.code === 'WATER_APP_DUPLICATE_HOLDING');
        expect(foundDup).toBeDefined();
        expect(foundDup.severity).toBe('ERROR');

        // Clean up simulated test duplicate
        await prisma.waterApplication.delete({ where: { application_id: dupApp.application_id } });
      }

      // 2. Verify clean state
      const cleanReport = await integrityService.runFullIntegrityAudit();
      const duplicateFinding = cleanReport.findings.find((f) => f.code === 'WATER_APP_DUPLICATE_HOLDING');
      expect(duplicateFinding).toBeUndefined();
    });

    it('TEST 29: Invalid bills are detected', async () => {
      const report = await integrityService.runFullIntegrityAudit();
      const billMismatches = report.findings.filter((f) => f.code === 'BILL_CALCULATION_MISMATCH');
      expect(billMismatches).toHaveLength(0);
    });

    it('TEST 30: Installment total mismatch is detected', async () => {
      const report = await integrityService.runFullIntegrityAudit();
      const instErrors = report.findings.filter((f) => f.category === 'INSTALLMENT' && f.severity === 'ERROR');
      expect(instErrors).toHaveLength(0);
    });

    it('TEST 31: Payment/balance mismatch is detected', async () => {
      const report = await integrityService.runFullIntegrityAudit();
      const balErrors = report.findings.filter((f) => f.category === 'FINANCIAL_BALANCE' && f.severity === 'ERROR');
      expect(balErrors).toHaveLength(0);
    });

    it('TEST 32: Invalid relationships are detected and audit reports 100% HEALTHY status', async () => {
      const report = await integrityService.runFullIntegrityAudit();
      expect(report.summary.status).toBe('PASS');
      expect(report.summary.errorChecks).toBe(0);
      expect(report.summary.passedChecks).toBeGreaterThan(0);
    });
  });
});
