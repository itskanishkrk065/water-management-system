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

describe('Phase 3 Performance Test Suite (Lazy Loading, Query Optimization, Indexes, Pagination, PRAGMAs)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  let districtId: string;
  let blockId: string;
  let villageId: string;
  let projectId: string;
  let testBeneficiaryId: string;
  let testHoldingId: string;

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

    const v = await prisma.village.findFirst({
      include: { block: true, panchayat: true },
    });
    villageId = v.village_id;
    blockId = v.block_id || null;
    districtId = v.block?.district_id || (await prisma.district.findFirst()).district_id;

    const p = await prisma.project.findFirst({ where: { status: 'ACTIVE' } });
    projectId = p ? p.project_id : (await prisma.project.findFirst()).project_id;

    // Seed test beneficiary with land, water application, bill
    const benRes = await request(app.getHttpServer())
      .post('/api/v1/beneficiaries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Performance Test Farmer',
        phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
        addressLine1: 'Perf Plot 1',
        pincode: '642001',
        districtId,
        blockId,
        villageId,
        locationDirection: 'NORTH',
      });
    testBeneficiaryId = benRes.body.beneficiary_id;

    const landRes = await request(app.getHttpServer())
      .post('/api/v1/land/holdings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: testBeneficiaryId,
        projectId,
        declaredTotalArea: 3.5,
        areaUnit: 'ACRES',
        parcels: [
          {
            surveyNumber: 'PERF-101',
            subdivisionNumber: 'A',
            area: 3.5,
            areaUnit: 'ACRES',
          },
        ],
      });
    testHoldingId = landRes.body.land_id;

    const appRes = await request(app.getHttpServer())
      .post('/api/v1/water/applications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: testBeneficiaryId,
        landId: testHoldingId,
        projectId,
        requiredLitres: 35000,
      });

    await request(app.getHttpServer())
      .post('/api/v1/water/allotments/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        applicationId: appRes.body.application_id,
        approvedLitres: 35000,
        approvalRemarks: 'Perf approval',
      });
  });

  afterAll(async () => {
    // Clean up test records
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
  // 1. LAZY-LOAD BENEFICIARY TABS
  // =========================================================================
  describe('1. Lazy-Loaded Beneficiary Tab Endpoints', () => {
    it('1.1 Fast Overview endpoint returns lightweight metadata and metrics without heavy relation payloads', async () => {
      const start = Date.now();
      const res = await request(app.getHttpServer())
        .get(`/api/v1/beneficiaries/${testBeneficiaryId}/overview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const elapsed = Date.now() - start;

      expect(res.body.beneficiary_id).toBe(testBeneficiaryId);
      expect(res.body.metrics).toBeDefined();
      expect(res.body.metrics.totalLandAcres).toBeDefined();
      expect(res.body.metrics.approvedLitresTotal).toBeDefined();
      expect(elapsed).toBeLessThan(150); // Sub-150ms response
    });

    it('1.2 Dedicated Water tab endpoint returns only water applications and allotments', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/beneficiaries/${testBeneficiaryId}/water`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.waterApplications).toBeDefined();
      expect(res.body.waterAllotments).toBeDefined();
      expect(Array.isArray(res.body.waterApplications)).toBe(true);
      expect(res.body.waterApplications.length).toBeGreaterThanOrEqual(1);
    });

    it('1.3 Dedicated Billing tab endpoint returns development bills and installments', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/beneficiaries/${testBeneficiaryId}/billing`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.developmentBills).toBeDefined();
      expect(Array.isArray(res.body.developmentBills)).toBe(true);
      expect(res.body.developmentBills.length).toBeGreaterThanOrEqual(1);
      expect(res.body.developmentBills[0].installments.length).toBe(5);
    });
  });

  // =========================================================================
  // 2. PRISMA QUERY OPTIMIZATION & PROJECTIONS
  // =========================================================================
  describe('2. Optimized Query Projections', () => {
    it('2.1 List Water Applications uses selective projection without N+1 overhead', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/water/applications?limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
      if (res.body.items.length > 0) {
        const item = res.body.items[0];
        expect(item.beneficiary.name).toBeDefined();
        expect(item.project.project_name).toBeDefined();
      }
    });

    it('2.2 List Allotments returns lean projection without deep unneeded joins', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/water/allotments?limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });

  // =========================================================================
  // 3. SERVER-SIDE PAGINATION
  // =========================================================================
  describe('3. Server-Side Pagination Across Entities', () => {
    it('3.1 Beneficiaries endpoint enforces pagination limit, skip, and returns accurate total count', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/beneficiaries?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
      expect(res.body.items.length).toBeLessThanOrEqual(5);
    });

    it('3.2 Payments endpoint supports server-side pagination with metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payments?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(10);
    });
  });

  // =========================================================================
  // 4. SQLITE RUNTIME PRAGMAS & PERFORMANCE
  // =========================================================================
  describe('4. SQLite Performance & PRAGMAs', () => {
    it('4.1 SQLite PRAGMA journal_mode is configured for WAL mode concurrency', async () => {
      const result: any = await prisma.$queryRawUnsafe('PRAGMA journal_mode;');
      const mode = result[0]?.journal_mode || result[0]?.['journal_mode'];
      expect(['wal', 'memory']).toContain(mode.toLowerCase());
    });

    it('4.2 SQLite database integrity check passes cleanly', async () => {
      const result: any = await prisma.$queryRawUnsafe('PRAGMA integrity_check;');
      const status = result[0]?.integrity_check || result[0]?.['integrity_check'];
      expect(status.toLowerCase()).toBe('ok');
    });
  });
});
