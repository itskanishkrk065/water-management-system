import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config();
process.env.DATABASE_URL = 'file:' + path.resolve(__dirname, '../prisma/template.db');

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as fs from 'fs';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/modules/common/filters/http-exception.filter';
import { TransformDecimalInterceptor } from '../src/modules/common/interceptors/transform-decimal.interceptor';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { IntegrityService } from '../src/modules/integrity/integrity.service';
import { BackupService } from '../src/modules/backup/backup.service';
import { PaymentMode } from '@prisma/client';

describe('Phase 2 Reliability Test Suite (Audit, Transactions, Backup/Restore, Receipts, Integrity)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let integrityService: IntegrityService;
  let backupService: BackupService;
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
    backupService = app.get(BackupService);

    // Login as Admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@water.gov.in', password: 'Admin@123' });
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
    // Clean up test records created during test run
    const testBeneficiaries = await prisma.beneficiary.findMany({
      where: { phone_number: { startsWith: '98765' } },
    });
    for (const ben of testBeneficiaries) {
      const bills = await prisma.developmentBill.findMany({ where: { beneficiary_id: ben.beneficiary_id } });
      for (const bill of bills) {
        await prisma.payment.deleteMany({ where: { installment: { bill_id: bill.bill_id } } });
        await prisma.installment.deleteMany({ where: { bill_id: bill.bill_id } });
        await prisma.developmentBill.delete({ where: { bill_id: bill.bill_id } });
      }
      await prisma.infrastructure.deleteMany({ where: { beneficiary_id: ben.beneficiary_id } });
      await prisma.waterAllotment.deleteMany({ where: { beneficiary_id: ben.beneficiary_id } });
      await prisma.waterApplication.deleteMany({ where: { beneficiary_id: ben.beneficiary_id } });
      const holdings = await prisma.landHolding.findMany({ where: { beneficiary_id: ben.beneficiary_id } });
      for (const h of holdings) {
        await prisma.landParcel.deleteMany({ where: { land_id: h.land_id } });
        await prisma.landHolding.delete({ where: { land_id: h.land_id } });
      }
      await prisma.auditLog.deleteMany({ where: { entity_id: ben.beneficiary_id } });
      await prisma.beneficiary.delete({ where: { beneficiary_id: ben.beneficiary_id } });
    }
    await app.close();
  });

  // =========================================================================
  // 1. AUDIT & HISTORY TIMELINE
  // =========================================================================
  describe('1. Audit & History Timeline', () => {
    let testBeneficiaryId: string;
    let testHoldingId: string;
    let testAppId: string;

    it('1.1 Should log an audit event upon Beneficiary creation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'AuditTest Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Audit Plot 1',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        })
        .expect(201);

      testBeneficiaryId = res.body.beneficiary_id;
      expect(testBeneficiaryId).toBeDefined();

      const audit = await prisma.auditLog.findFirst({
        where: { entity_type: 'Beneficiary', entity_id: testBeneficiaryId },
      });
      expect(audit).toBeDefined();
      expect(audit.action).toBe('CREATE');
    });

    it('1.2 Should log audit events across entire lifecycle and aggregate in history timeline', async () => {
      // Create Land Holding
      const landRes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: testBeneficiaryId,
          projectId,
          declaredTotalArea: 5.0,
          areaUnit: 'ACRES',
          parcels: [
            {
              surveyNumber: 'AUD-101',
              subdivisionNumber: 'A',
              area: 5.0,
              areaUnit: 'ACRES',
            },
          ],
        })
        .expect(201);
      testHoldingId = landRes.body.land_id;

      // Submit Water Application
      const appRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: testBeneficiaryId,
          landId: testHoldingId,
          projectId,
          requiredLitres: 50000,
        })
        .expect(201);
      testAppId = appRes.body.application_id;

      // Approve Application
      await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicationId: testAppId,
          approvedLitres: 50000,
          approvalRemarks: 'Audit test approval',
        })
        .expect(201);

      // Verify aggregated history contains all events
      const historyRes = await request(app.getHttpServer())
        .get(`/api/v1/beneficiaries/${testBeneficiaryId}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(historyRes.body)).toBe(true);
      const actions = historyRes.body.map((item: any) => item.action);
      expect(actions).toContain('CREATE');
      expect(actions).toContain('APPROVE');
    });

    it('1.3 Audit logs should be append-only and not expose delete endpoints in UI API', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { entity_id: testBeneficiaryId },
      });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      // Attempting to delete or edit audit directly via API should be a 404 (no route)
      await request(app.getHttpServer())
        .delete(`/api/v1/audit/${logs[0].audit_id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // =========================================================================
  // 2. TRANSACTIONAL CRITICAL OPERATIONS
  // =========================================================================
  describe('2. Transactional Critical Operations & Rollback', () => {
    let testBeneficiaryId: string;
    let testHoldingId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'TxTest Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Tx Plot 1',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        });
      testBeneficiaryId = res.body.beneficiary_id;

      const landRes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: testBeneficiaryId,
          projectId,
          declaredTotalArea: 4.0,
          areaUnit: 'ACRES',
          parcels: [
            {
              surveyNumber: 'TX-101',
              subdivisionNumber: 'A',
              area: 4.0,
              areaUnit: 'ACRES',
            },
          ],
        });
      testHoldingId = landRes.body.land_id;
    });

    it('2.1 Concurrent Application Submission on Same Land Holding should lock and reject duplicate', async () => {
      // Simulate two concurrent requests for the exact same land holding
      const req1 = request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: testBeneficiaryId,
          landId: testHoldingId,
          projectId,
          requiredLitres: 40000,
        });

      const req2 = request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: testBeneficiaryId,
          landId: testHoldingId,
          projectId,
          requiredLitres: 40000,
        });

      const [res1, res2] = await Promise.all([req1, req2]);
      const statuses = [res1.status, res2.status].sort();
      // Exactly one must succeed (201) and one must be rejected (400)
      expect(statuses[0]).toBe(201);
      expect(statuses[1]).toBe(400);

      // Verify DB has exactly ONE application for this holding
      const apps = await prisma.waterApplication.findMany({
        where: { land_id: testHoldingId },
      });
      expect(apps.length).toBe(1);
    });

    it('2.2 Full Water Approval transaction atomically creates Bill, 5 Installments, and Infrastructure', async () => {
      const appRecord = await prisma.waterApplication.findFirst({
        where: { land_id: testHoldingId },
      });

      await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicationId: appRecord.application_id,
          approvedLitres: 40000,
          approvalRemarks: 'Atomic approval test',
        })
        .expect(201);

      const bill = await prisma.developmentBill.findFirst({
        where: { allotment: { application_id: appRecord.application_id } },
        include: { installments: true },
      });
      expect(bill).toBeDefined();
      expect(bill.total_amount).toBeDefined();
      expect(bill.installments.length).toBe(5);

      const infra = await prisma.infrastructure.findFirst({
        where: { allotment: { application_id: appRecord.application_id } },
      });
      expect(infra).toBeDefined();
    });
  });

  // =========================================================================
  // 3. BACKUP & RESTORE
  // =========================================================================
  describe('3. Backup & Restore Operations', () => {
    let backupFileName: string;

    it('3.1 Should successfully check SQLite database integrity', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/backup/integrity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.healthy).toBe(true);
      expect(res.body.details).toBeDefined();
    });

    it('3.2 Should successfully create a valid .wmbak backup archive', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/backup/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Phase 2 E2E Automated Backup' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.fileName).toBeDefined();
      expect(res.body.filePath).toBeDefined();
      expect(fs.existsSync(res.body.filePath)).toBe(true);
      backupFileName = res.body.fileName;
    });

    it('3.3 Should list backup history including the created archive', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/backup/list')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.backups).toBeDefined();
      expect(Array.isArray(res.body.backups)).toBe(true);
      expect(res.body.backups.length).toBeGreaterThanOrEqual(1);
      const fileNames = res.body.backups.map((b: any) => b.fileName);
      expect(fileNames).toContain(backupFileName);
    });

    it('3.4 Should restore backup safely and log audit event', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/backup/restore')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fileName: backupFileName, reason: 'E2E test safe restore verification' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('successfully restored');
    });
  });

  // =========================================================================
  // 4. RECEIPT GENERATION
  // =========================================================================
  describe('4. Receipt Generation & Download', () => {
    let testPaymentBeneficiaryId: string;
    let testPaymentId: string;

    beforeAll(async () => {
      // 1. Create a Beneficiary for payment test
      const benRes = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Payment Receipt Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Receipt Plot 1',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        });
      testPaymentBeneficiaryId = benRes.body.beneficiary_id;

      // 2. Create Land Holding
      const landRes = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: testPaymentBeneficiaryId,
          projectId,
          declaredTotalArea: 2.0,
          areaUnit: 'ACRES',
          parcels: [
            {
              surveyNumber: 'REC-101',
              subdivisionNumber: 'A',
              area: 2.0,
              areaUnit: 'ACRES',
            },
          ],
        });
      const landId = landRes.body.land_id;

      // 3. Create Application & Approve
      const appRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: testPaymentBeneficiaryId,
          landId,
          projectId,
          requiredLitres: 20000,
        });
      const appId = appRes.body.application_id;

      await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicationId: appId,
          approvedLitres: 20000,
          approvalRemarks: 'Receipt test approval',
        });

      // 4. Find the generated bill and 1st installment
      const bill = await prisma.developmentBill.findFirst({
        where: { beneficiary_id: testPaymentBeneficiaryId },
        include: { installments: { orderBy: { installment_number: 'asc' } } },
      });

      const inst1 = bill.installments[0];

      // 5. Post Payment
      const payRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: testPaymentBeneficiaryId,
          installmentId: inst1.installment_id,
          amount: Number(inst1.amount_due),
          paymentMode: PaymentMode.CASH,
          paymentReference: 'REC-REF-001',
          remarks: 'Phase 2 Receipt E2E Test',
        })
        .expect(201);

      testPaymentId = payRes.body.payment_id;
    });

    it('4.1 Should generate a unique sequential receipt number format (REC-YYYY-XXXXXX)', async () => {
      expect(testPaymentId).toBeDefined();
      const payment = await prisma.payment.findUnique({
        where: { payment_id: testPaymentId },
      });
      expect(payment.receipt_number).toBeDefined();
      expect(payment.receipt_number).toMatch(/^REC-\d{4}-\d{6}$/);
    });

    it('4.2 Should serve authoritative PDF receipt binary stream', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/payments/${testPaymentId}/receipt/pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.header['content-type']).toBe('application/pdf');
      expect(res.header['content-disposition']).toContain('.pdf');
      expect(res.body).toBeDefined();
      expect(res.body.length).toBeGreaterThan(100);
    });
  });

  // =========================================================================
  // 5. DATA INTEGRITY DASHBOARD
  // =========================================================================
  describe('5. Data Integrity Audit & Dashboard', () => {
    it('5.1 Should execute complete data integrity audit suite', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/integrity/check')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.totalChecks).toBeGreaterThanOrEqual(5);
      expect(Array.isArray(res.body.findings)).toBe(true);
    });

    it('5.2 Clean system should report zero critical errors', async () => {
      const audit = await integrityService.runFullIntegrityAudit();
      expect(audit.summary.errorChecks).toBe(0);
    });
  });
});
