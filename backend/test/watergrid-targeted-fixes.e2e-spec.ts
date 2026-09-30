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

describe('WaterGrid Targeted Fixes E2E Test Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  let districtId: string;
  let blockId: string;
  let villageId: string;
  let projectId: string;
  const runId = Math.floor(1000 + Math.random() * 9000);

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Water Eligibility & Exclusion of Fulfilled/Approved Holdings', () => {
    let benId: string;
    let holding1Id: string;
    let holding2Id: string;
    let holding3Id: string;
    let app2Id: string;

    it('creates beneficiary with 3 holdings', async () => {
      const benRes = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Eligibility Test Farmer',
          phoneNumber: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          addressLine1: 'Test Farm 88',
          pincode: '642001',
          districtId,
          blockId,
          villageId,
          locationDirection: 'NORTH',
        })
        .expect(201);
      benId = benRes.body.beneficiary_id;

      // Holding 1
      const h1Res = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benId,
          projectId,
          declaredTotalArea: 4.0,
          parcels: [{ surveyNumber: `ELG-${runId}-1`, subdivisionNumber: 'A', area: 4.0 }],
        })
        .expect(201);
      holding1Id = h1Res.body.land_id;

      // Holding 2
      const h2Res = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benId,
          projectId,
          declaredTotalArea: 3.0,
          parcels: [{ surveyNumber: `ELG-${runId}-2`, subdivisionNumber: 'B', area: 3.0 }],
        })
        .expect(201);
      holding2Id = h2Res.body.land_id;

      // Holding 3
      const h3Res = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benId,
          projectId,
          declaredTotalArea: 2.0,
          parcels: [{ surveyNumber: `ELG-${runId}-3`, subdivisionNumber: 'C', area: 2.0 }],
        })
        .expect(201);
      holding3Id = h3Res.body.land_id;
    });

    it('initially all 3 holdings are eligible for water applications', async () => {
      const elgRes = await request(app.getHttpServer())
        .get(`/api/v1/water/eligible-holdings/${benId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(elgRes.body.eligible_holdings.length).toBe(3);
      const ids = elgRes.body.eligible_holdings.map((h: any) => h.land_id);
      expect(ids).toContain(holding1Id);
      expect(ids).toContain(holding2Id);
      expect(ids).toContain(holding3Id);
    });

    it('creates and approves water application for Holding 2 -> Holding 2 becomes ineligible', async () => {
      // Create application on Holding 2
      const appRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benId,
          landId: holding2Id,
          projectId,
          requiredLitres: 30000,
          remarks: 'Quota application for Holding 2',
        })
        .expect(201);
      app2Id = appRes.body.application_id;

      // Approve application
      await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicationId: app2Id,
          approvedLitres: 30000,
          approvalRemarks: 'Approved for Holding 2',
        })
        .expect(201);

      // Verify eligible holdings now excludes Holding 2 (only Holding 1 and 3 present)
      const elgRes = await request(app.getHttpServer())
        .get(`/api/v1/water/eligible-holdings/${benId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(elgRes.body.eligible_holdings.length).toBe(2);
      const ids = elgRes.body.eligible_holdings.map((h: any) => h.land_id);
      expect(ids).toContain(holding1Id);
      expect(ids).toContain(holding3Id);
      expect(ids).not.toContain(holding2Id);
    });

    it('backend rejects direct attempt to create new water application for Holding 2', async () => {
      const rejectRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: benId,
          landId: holding2Id,
          projectId,
          requiredLitres: 15000,
          remarks: 'Bypassing frontend check',
        })
        .expect(400);

      const msg = Array.isArray(rejectRes.body.message)
        ? rejectRes.body.message.join(' ')
        : rejectRes.body.message;
      expect(msg).toMatch(/already has an active water application/i);
    });
  });

  describe('2. Real-Time Parcel Availability Validation API', () => {
    let checkHoldingId: string;

    beforeAll(async () => {
      const ben = await prisma.beneficiary.create({
        data: {
          name: 'Parcel Test User',
          phone_number: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          address_line_1: '123 Parcel St',
          pincode: '642001',
          district_id: districtId,
          block_id: blockId,
          village_id: villageId,
        },
      });
      const holding = await prisma.landHolding.create({
        data: {
          beneficiary_id: ben.beneficiary_id,
          project_id: projectId,
          declared_total_area: 5.0,
          status: 'ACTIVE',
        },
      });
      checkHoldingId = holding.land_id;
      await prisma.landParcel.create({
        data: {
          land_id: checkHoldingId,
          survey_number: `PAR-${runId}-101`,
          subdivision_number: 'A',
          area: 5.0,
        },
      });
    });

    it('returns AVAILABLE for unused survey and subdivision', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/land/parcels/check-availability')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          surveyNumber: `PAR-${runId}-999`,
          subdivisionNumber: 'X',
        })
        .expect(200);

      expect(res.body.available).toBe(true);
      expect(res.body.status).toBe('AVAILABLE');
    });

    it('returns DUPLICATE for existing survey and subdivision', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/land/parcels/check-availability')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          surveyNumber: `PAR-${runId}-101`,
          subdivisionNumber: 'A',
        })
        .expect(200);

      expect(res.body.available).toBe(false);
      expect(res.body.status).toBe('DUPLICATE');
      expect(res.body.message).toMatch(/already registered/i);
    });

    it('returns AVAILABLE for same survey with different subdivision', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/land/parcels/check-availability')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          surveyNumber: `PAR-${runId}-101`,
          subdivisionNumber: 'B',
        })
        .expect(200);

      expect(res.body.available).toBe(true);
      expect(res.body.status).toBe('AVAILABLE');
    });

    it('returns AVAILABLE when editing the same parcel (currentParcelId exclusion)', async () => {
      const parcel = await prisma.landParcel.findFirst({
        where: { survey_number: `PAR-${runId}-101`, subdivision_number: 'A' },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/land/parcels/check-availability')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          surveyNumber: `PAR-${runId}-101`,
          subdivisionNumber: 'A',
          currentParcelId: parcel.parcel_id,
        })
        .expect(200);

      expect(res.body.available).toBe(true);
      expect(res.body.status).toBe('AVAILABLE');
    });
  });

  describe('3. Location Master Data & Safe Deletion', () => {
    it('returns only active districts (COIMBATORE & TIRUPPUR)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/locations/districts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const names = res.body.map((d: any) => d.name);
      expect(names).toContain('COIMBATORE');
      expect(names).toContain('TIRUPPUR');
      expect(names).not.toContain('KANCHEEPURAM');
      // No duplicate Tiruppur
      const tiruppurs = res.body.filter((d: any) => d.name === 'TIRUPPUR');
      expect(tiruppurs.length).toBe(1);
    });

    it('safely creates and deletes an unused test district', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/locations/districts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `TEST-DIST-${runId}`,
          lgdDistrictCode: 99000 + runId,
        })
        .expect(201);
      const testDistId = createRes.body.district_id;

      // Safe delete succeeds since no blocks/beneficiaries reference it
      await request(app.getHttpServer())
        .delete(`/api/v1/locations/districts/${testDistId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('rejects deletion of a referenced district', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/locations/districts/${districtId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.message).toMatch(/cannot delete district/i);
    });
  });

  describe('4. Safe Land Holding & Water Application Deletion', () => {
    let testBenId: string;
    let safeHoldingId: string;
    let referencedHoldingId: string;
    let draftAppId: string;
    let approvedAppId: string;

    beforeAll(async () => {
      const ben = await prisma.beneficiary.create({
        data: {
          name: 'Delete Test User',
          phone_number: `98765${Math.floor(10000 + Math.random() * 90000)}`,
          address_line_1: '99 Delete St',
          pincode: '642001',
          district_id: districtId,
          block_id: blockId,
          village_id: villageId,
        },
      });
      testBenId = ben.beneficiary_id;

      // Safe unused holding
      const h1 = await prisma.landHolding.create({
        data: {
          beneficiary_id: testBenId,
          project_id: projectId,
          declared_total_area: 2.0,
          status: 'ACTIVE',
        },
      });
      safeHoldingId = h1.land_id;
      await prisma.landParcel.create({
        data: {
          land_id: safeHoldingId,
          survey_number: `DEL-${runId}-1`,
          subdivision_number: 'A',
          area: 2.0,
        },
      });

      // Referenced holding
      const h2 = await prisma.landHolding.create({
        data: {
          beneficiary_id: testBenId,
          project_id: projectId,
          declared_total_area: 3.0,
          status: 'ACTIVE',
        },
      });
      referencedHoldingId = h2.land_id;
      await prisma.landParcel.create({
        data: {
          land_id: referencedHoldingId,
          survey_number: `DEL-${runId}-2`,
          subdivision_number: 'B',
          area: 3.0,
        },
      });

      // Create Draft application
      const draftRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: testBenId,
          landId: safeHoldingId,
          projectId,
          requiredLitres: 20000,
          remarks: 'Draft app',
        })
        .expect(201);
      draftAppId = draftRes.body.application_id;

      // Update status to DRAFT directly
      await prisma.waterApplication.update({
        where: { application_id: draftAppId },
        data: { status: 'DRAFT' },
      });

      // Create and approve application on referenced holding
      const appRes = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: testBenId,
          landId: referencedHoldingId,
          projectId,
          requiredLitres: 30000,
          remarks: 'Approved app',
        })
        .expect(201);
      approvedAppId = appRes.body.application_id;

      await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicationId: approvedAppId,
          approvedLitres: 30000,
          approvalRemarks: 'Approved for test',
        })
        .expect(201);
    });

    it('safely deletes draft water application', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/water/applications/${draftAppId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = await prisma.waterApplication.findUnique({
        where: { application_id: draftAppId },
      });
      expect(found).toBeNull();
    });

    it('rejects hard deletion of approved water application', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/water/applications/${approvedAppId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.message).toMatch(/cannot permanently delete/i);
    });

    it('allows cancelling approved water application instead', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/water/applications/${approvedAppId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Beneficiary requested cancellation' })
        .expect(201);

      expect(res.body.status).toBe('VOIDED');
    });

    it('safely deletes unused land holding', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/land/holdings/${safeHoldingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = await prisma.landHolding.findUnique({
        where: { land_id: safeHoldingId },
      });
      expect(found).toBeNull();
    });

    it('rejects hard deletion of land holding with linked water application / allotment', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/land/holdings/${referencedHoldingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.message).toMatch(/cannot be permanently deleted/i);
    });
  });
});
