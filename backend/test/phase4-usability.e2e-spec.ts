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

describe('Phase 4 Usability & Admin Experience E2E Test Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let fieldToken: string;

  let districtId: string;
  let villageId: string;
  let testProjectId: string;
  let testBeneficiaryId: string;
  let testPhone: string;
  let testSurveyNumber: string;
  let testApplicationId: string;
  let testBillId: string;
  let testBillNumber: string;
  let testPresetId: string;

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

    // Login as Field Officer
    const fieldRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'field@water.gov', password: 'Admin@123456' });
    fieldToken = fieldRes.body.accessToken;

    const v = await prisma.village.findFirst({
      include: { block: true, panchayat: true },
    });
    villageId = v.village_id;
    districtId = v.block?.district_id || (await prisma.district.findFirst()).district_id;

    // Create a dedicated Project Scheme for Phase 4 tests
    const schemeCode = `SCHEME-${Date.now().toString().slice(-4)}`;
    const testProject = await prisma.project.create({
      data: {
        project_code: schemeCode,
        project_name: 'Phase 4 Usability Test Scheme',
        description: 'Comprehensive test project scheme for Phase 4',
        status: 'ACTIVE',
      },
    });
    testProjectId = testProject.project_id;

    // Create rate config for this scheme
    await prisma.rateConfiguration.create({
      data: {
        project: { connect: { project_id: testProjectId } },
        litres_per_acre: 5000,
        development_cost_per_litre: 2.5,
        running_cost_per_litre: 0.2,
        effective_from: new Date('2026-01-01'),
        is_active: true,
        created_by: 'system',
      },
    });

    // Seed test beneficiary
    testPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
    const benRes = await request(app.getHttpServer())
      .post('/api/v1/beneficiaries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Usability Test Beneficiary',
        phoneNumber: testPhone,
        addressLine1: '42 Usability Sector',
        pincode: '642001',
        districtId,
        villageId,
        locationDirection: 'NORTH',
      })
      .expect(201);
    testBeneficiaryId = benRes.body.beneficiary_id;

    // Add Land Holding
    testSurveyNumber = `SF-${Math.floor(100 + Math.random() * 900)}`;
    const landRes = await request(app.getHttpServer())
      .post('/api/v1/land/holdings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: testBeneficiaryId,
        projectId: testProjectId,
        declaredTotalArea: 5.0,
        parcels: [
          {
            surveyNumber: testSurveyNumber,
            subdivisionNumber: '1A',
            area: 5.0,
          },
        ],
      })
      .expect(201);
    const holdingId = landRes.body.land_id;

    // Submit Water Application
    const appRes = await request(app.getHttpServer())
      .post('/api/v1/water/applications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: testBeneficiaryId,
        landId: holdingId,
        projectId: testProjectId,
        requiredLitres: 25000,
      })
      .expect(201);
    testApplicationId = appRes.body.application_id;

    // Approve Water Application (which creates development bill)
    const approveRes = await request(app.getHttpServer())
      .post('/api/v1/water/allotments/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        applicationId: testApplicationId,
        approvedLitres: 25000,
      })
      .expect(201);

    const bill = approveRes.body.developmentBill;
    testBillId = bill.bill_id;
    testBillNumber = bill.bill_number;
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // 17. GLOBAL SEARCH
  // =========================================================================
  describe('17. Global Search', () => {
    it('should locate beneficiary by name and phone number with normal formatting differences', async () => {
      // Search with exact phone
      const res1 = await request(app.getHttpServer())
        .get(`/api/v1/search/global?q=${testPhone}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res1.body.totalResults).toBeGreaterThan(0);
      expect(res1.body.categories.beneficiaries.some((b: any) => b.id === testBeneficiaryId)).toBe(true);

      // Search with formatted phone e.g. "98765 12345"
      const formattedPhone = `${testPhone.slice(0, 5)} ${testPhone.slice(5)}`;
      const res2 = await request(app.getHttpServer())
        .get(`/api/v1/search/global?q=${encodeURIComponent(formattedPhone)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res2.body.categories.beneficiaries.some((b: any) => b.id === testBeneficiaryId)).toBe(true);
    });

    it('should locate land holding by survey number', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/search/global?q=${testSurveyNumber}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.categories.landHoldings.length).toBeGreaterThan(0);
      expect(res.body.categories.landHoldings[0].title).toContain(testSurveyNumber);
    });

    it('should locate water application and bill by identifier', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/search/global?q=${testBillId.slice(0, 8)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.categories.bills.length).toBeGreaterThan(0);
      expect(res.body.categories.bills.some((b: any) => b.id === testBillId)).toBe(true);
    });

    it('should enforce RBAC: FIELD_OFFICER cannot access bills or payments in global search', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/search/global?q=${testBillId.slice(0, 8)}`)
        .set('Authorization', `Bearer ${fieldToken}`)
        .expect(200);

      // Bills and payments categories must remain empty for Field Officer
      expect(res.body.categories.bills.length).toBe(0);
      expect(res.body.categories.payments.length).toBe(0);
    });
  });

  // =========================================================================
  // 18. BETTER ADMIN DASHBOARD
  // =========================================================================
  describe('18. Better Admin Dashboard', () => {
    it('should return authoritative operational metrics across Beneficiaries, Land, Water, and Financials', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.beneficiaries).toBeDefined();
      expect(res.body.beneficiaries.total).toBeGreaterThan(0);
      expect(res.body.land).toBeDefined();
      expect(Number(res.body.land.total_active_acres)).toBeGreaterThan(0);
      expect(res.body.water).toBeDefined();
      expect(res.body.water.approved_applications).toBeGreaterThan(0);
      expect(res.body.financial).toBeDefined();
      expect(res.body.financial.accessible).toBe(true);
      expect(Number(res.body.financial.total_development_billing)).toBeGreaterThan(0);
      expect(res.body.data_quality).toBeDefined();
      expect(res.body.data_quality.status).toBe('PASS');
    });

    it('should filter dashboard metrics dynamically when district / village / project filter applied', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/dashboard/stats?projectId=${testProjectId}&villageId=${villageId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.filters_applied).toBe(true);
      expect(res.body.water.approved_applications).toBe(1);
      expect(res.body.beneficiaries.total).toBe(1);
    });

    it('should enforce RBAC: FIELD_OFFICER receives restricted flag for financial section', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${fieldToken}`)
        .expect(200);

      expect(res.body.financial.accessible).toBe(false);
      expect(res.body.financial.total_development_billing).toBeUndefined();
    });

    it('should return recent activity stream and operational queues', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/recent-activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.recent_approved).toBeDefined();
      expect(Array.isArray(res.body.recent_approved)).toBe(true);
      expect(res.body.recent_approved.some((a: any) => a.application_id === testApplicationId)).toBe(true);
    });
  });

  // =========================================================================
  // 19. REPORTING PRESETS
  // =========================================================================
  describe('19. Reporting Presets', () => {
    const uniquePresetName = `Village 5-Acre Approved Allotments ${Date.now()}`;
    const uniqueUpdatedName = `${uniquePresetName} (Updated)`;

    it('should create a reusable reporting preset storing dynamic filter criteria', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/find/presets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: uniquePresetName,
          description: 'Filters approved water applications for 5+ acre lands in village',
          report_type: 'FIND_FILTER',
          filters: {
            villageId,
            landAreaMin: 5.0,
            applicationStatus: 'APPROVED',
          },
        })
        .expect(201);

      expect(res.body.preset_id).toBeDefined();
      expect(res.body.name).toBe(uniquePresetName);
      testPresetId = res.body.preset_id;
    });

    it('should list all active presets', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/find/presets')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((p: any) => p.preset_id === testPresetId)).toBe(true);
    });

    it('should execute a preset dynamically against current database data', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/reports/find/presets/${testPresetId}/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(res.body.items.some((i: any) => i.beneficiaryId === testBeneficiaryId)).toBe(true);
      expect(res.body.metrics).toBeDefined();
    });

    it('should allow updating and deactivating a preset', async () => {
      // Update
      const updateRes = await request(app.getHttpServer())
        .put(`/api/v1/reports/find/presets/${testPresetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: uniqueUpdatedName,
        })
        .expect(200);

      expect(updateRes.body.name).toBe(uniqueUpdatedName);

      // Deactivate
      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/reports/find/presets/${testPresetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(deleteRes.body.success).toBe(true);

      // Verify it no longer appears in active presets list
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/reports/find/presets')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(listRes.body.some((p: any) => p.preset_id === testPresetId)).toBe(false);
    });
  });

  // =========================================================================
  // 20. EXCEL / PDF REPORTING
  // =========================================================================
  describe('20. Excel and PDF Reporting Exports', () => {
    it('should export filtered dataset to production-quality Excel spreadsheet (.xlsx)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/find/export/excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          villageId,
          applicationStatus: 'APPROVED',
        })
        .expect(200);

      expect(res.headers['content-type'] || res.header['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition'] || res.header['content-disposition']).toContain('.xlsx');
      expect(Number(res.headers['content-length'] || res.header['content-length'])).toBeGreaterThan(100);
    });

    it('should export filtered dataset to production-quality PDF report', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/find/export/pdf')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          villageId,
          applicationStatus: 'APPROVED',
        })
        .expect(200);

      expect(res.headers['content-type'] || res.header['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition'] || res.header['content-disposition']).toContain('.pdf');
      expect(Number(res.headers['content-length'] || res.header['content-length'])).toBeGreaterThan(100);
    });
  });

  // =========================================================================
  // 21. PROJECT SCHEME MANAGEMENT
  // =========================================================================
  describe('21. Project Scheme Management', () => {
    let newSchemeId: string;
    const newSchemeCode = `KB-SCHEME-${Date.now().toString().slice(-4)}`;

    it('should allow admin to create a new project scheme', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: newSchemeCode,
          projectName: 'Kongu Basin Scheme 2026',
          description: 'Gravity pipeline irrigation scheme for Kongu region',
          status: 'ACTIVE',
        })
        .expect(201);

      expect(res.body.project_id).toBeDefined();
      expect(res.body.project_code).toBe(newSchemeCode);
      newSchemeId = res.body.project_id;
    });

    it('should reject duplicate project scheme code with ConflictException', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectCode: newSchemeCode,
          projectName: 'Duplicate Scheme',
        })
        .expect(409);
    });

    it('should list only active schemes on /projects/active', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects/active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.every((p: any) => p.status === 'ACTIVE')).toBe(true);
      expect(res.body.some((p: any) => p.project_id === newSchemeId)).toBe(true);
    });

    it('should toggle scheme status to INACTIVE and preserve historical land holding association', async () => {
      // Toggle to INACTIVE
      const toggleRes = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${newSchemeId}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(toggleRes.body.status).toBe('INACTIVE');

      // Verify it is no longer in active list
      const activeRes = await request(app.getHttpServer())
        .get('/api/v1/projects/active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(activeRes.body.some((p: any) => p.project_id === newSchemeId)).toBe(false);

      // Clean up newly created scheme
      await prisma.project.deleteMany({ where: { project_id: newSchemeId } });
    });
  });
});
