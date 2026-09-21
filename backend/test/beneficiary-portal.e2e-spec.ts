import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { Decimal } from 'decimal.js';

describe('Beneficiary Portal E2E & Ownership Security Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let fieldToken: string;
  let beneficiaryAToken: string;
  let beneficiaryAId: string;
  let beneficiaryBToken: string;
  let beneficiaryBId: string;
  let sampleVillageId: string;
  let samplePanchayatId: string;
  let sampleDistrictId: string;
  let activeProjectId: string;

  let landAId: string;
  let applicationAId: string;
  let paymentAId: string;

  const uniqueSuffix = Date.now().toString().slice(-6);
  const phoneA = `9843${uniqueSuffix}`;
  const phoneB = `9844${uniqueSuffix}`;
  const emailA = `farmer_a_${uniqueSuffix}@water.gov`;
  const emailB = `farmer_b_${uniqueSuffix}@water.gov`;

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
      }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Admin login
    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@water.gov', password: 'Admin@123456' })
      .expect(200);
    adminToken = adminLoginRes.body.accessToken;

    // Field Officer login
    const fieldLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'field@water.gov', password: 'Admin@123456' })
      .expect(200);
    fieldToken = fieldLoginRes.body.accessToken;

    // Fetch sample village and project
    const village = await prisma.village.findFirst({
      include: { panchayat: { include: { district: true } } },
    });
    sampleVillageId = village!.village_id;
    samplePanchayatId = village!.panchayat_id;
    sampleDistrictId = village!.panchayat.district_id;

    const project = await prisma.project.findFirst({ where: { status: 'ACTIVE' } });
    activeProjectId = project!.project_id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Section 1: Beneficiary Sign Up & Authentication Flow', () => {
    it('Step 1: Sign up new Beneficiary A successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/beneficiary-signup')
        .send({
          fullName: 'Kandasamy Gounder',
          phoneNumber: phoneA,
          email: emailA,
          password: 'Secret@123456',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.role).toBe('BENEFICIARY');
      expect(res.body.user.email).toBe(emailA);
      expect(res.body.beneficiary).toBeDefined();
      expect(res.body.beneficiary.phone_number).toBe(phoneA);

      beneficiaryAToken = res.body.accessToken;
      beneficiaryAId = res.body.beneficiary.beneficiary_id;
    });

    it('Step 1b: Sign up with snake_case payload (full_name and phone) successfully', async () => {
      const snakePhone = `9555${uniqueSuffix}`;
      const snakeEmail = `snake_${uniqueSuffix}@water.gov`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/beneficiary-signup')
        .send({
          full_name: 'Snake Case Beneficiary',
          phone: snakePhone,
          email: snakeEmail,
          password: 'Secret@123456',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.full_name).toBe('Snake Case Beneficiary');
      expect(res.body.beneficiary.phone_number).toBe(snakePhone);
    });

    it('Step 2: Reject duplicate registration with same phone number', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/beneficiary-signup')
        .send({
          fullName: 'Duplicate Phone Person',
          phoneNumber: phoneA,
          email: `unique_${uniqueSuffix}@water.gov`,
          password: 'Secret@123456',
        })
        .expect(409);

      expect(res.body.message).toContain('Phone number');
    });

    it('Step 3: Reject duplicate registration with same email address', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/beneficiary-signup')
        .send({
          fullName: 'Duplicate Email Person',
          phoneNumber: `9111${uniqueSuffix}`,
          email: emailA,
          password: 'Secret@123456',
        })
        .expect(409);

      expect(res.body.message).toContain('email');
    });

    it('Step 4: Reject sign up with invalid short password (< 6 chars)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/beneficiary-signup')
        .send({
          fullName: 'Short Pass Person',
          phoneNumber: `9222${uniqueSuffix}`,
          email: `shortpass_${uniqueSuffix}@water.gov`,
          password: '123',
        })
        .expect(400);
    });

    it('Step 5: Beneficiary can log in via standard /auth/login route', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: emailA, password: 'Secret@123456' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe('BENEFICIARY');
      expect(res.body.user.beneficiary_id).toBe(beneficiaryAId);
    });
  });

  describe('Section 2: Profile Completion Wizard', () => {
    it('Step 6: Initial profile completion is 20% (Personal information only)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/me')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(res.body.completionPercent).toBe(20);
      expect(res.body.checklist.find((c: any) => c.id === 'personal').completed).toBe(true);
      expect(res.body.checklist.find((c: any) => c.id === 'address').completed).toBe(false);
    });

    it('Step 7: Update profile address and geographic location', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/beneficiary/me')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .send({
          addressLine1: 'Survey 102/3B, Old Canal Road',
          districtId: sampleDistrictId,
          panchayatId: samplePanchayatId,
          villageId: sampleVillageId,
          pincode: '642001',
          locationDirection: 'NORTH',
          locationDescription: 'North side field opposite primary cooperative bank',
        })
        .expect(200);

      expect(res.body.address_line_1).toContain('Survey 102/3B');
      expect(res.body.location_direction).toBe('NORTH');
    });

    it('Step 8: Profile completion score increases to 60% after Address and Location setup', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/me')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(res.body.completionPercent).toBe(60);
      expect(res.body.checklist.find((c: any) => c.id === 'address').completed).toBe(true);
      expect(res.body.checklist.find((c: any) => c.id === 'location').completed).toBe(true);
      expect(res.body.checklist.find((c: any) => c.id === 'land').completed).toBe(false);
    });
  });

  describe('Section 3: Land Management & Parcel Area Checksums', () => {
    it('Step 9: Fails when parcel sum (3.5) does not match declared total area (4.0 acres)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/beneficiary/land')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .send({
          pattaNumber: 'PATTA-9001',
          declaredTotalArea: 4.0,
          parcels: [
            { surveyNumber: '201', subdivisionNumber: '1A', areaAcres: 2.0 },
            { surveyNumber: '201', subdivisionNumber: '1B', areaAcres: 1.5 }, // sum = 3.5 != 4.0
          ],
        })
        .expect(400);

      expect(res.body.message).toContain('Difference');
    });

    it('Step 10: Succeeds when parcel sum matches declared total area exactly (4.0 acres in 2 parcels)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/beneficiary/land')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .send({
          pattaNumber: 'PATTA-9001',
          declaredTotalArea: 4.0,
          parcels: [
            { surveyNumber: '201', subdivisionNumber: '1A', areaAcres: 2.5 },
            { surveyNumber: '201', subdivisionNumber: '1B', areaAcres: 1.5 },
          ],
        })
        .expect(201);

      expect(res.body.land_id).toBeDefined();
      expect(res.body.parcels.length).toBe(2);
      landAId = res.body.land_id;
    });

    it('Step 11: Total active land computed accurately and completion score reaches 80%', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/land')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(parseFloat(res.body.totalActiveAcres)).toBeCloseTo(4.0, 4);

      const me = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/me')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(me.body.completionPercent).toBe(80);
      expect(me.body.checklist.find((c: any) => c.id === 'land').completed).toBe(true);
    });
  });

  describe('Section 4: Transparent Water Calculation & Application', () => {
    it('Step 12: Preview calculates allotment accurately: 4.0 acres * 10,000 L/acre = 40,000 L', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/water/preview')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(parseFloat(res.body.totalLandAcres)).toBeCloseTo(4.0, 4);
      expect(parseFloat(res.body.calculatedAllottedLitres)).toBeCloseTo(40000.0, 2);
      expect(parseFloat(res.body.estimatedDevelopmentCost)).toBeCloseTo(80000.0, 2);
    });

    it('Step 13: Beneficiary submits water requirement application for 35,000 litres', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/beneficiary/water/applications')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .send({
          requiredLitres: 35000,
          remarks: 'Sugarcane cultivation crop season',
        })
        .expect(201);

      expect(res.body.application_id).toBeDefined();
      expect(res.body.status).toBe('SUBMITTED');
      applicationAId = res.body.application_id;

      // Profile completion now reaches 100%
      const me = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/me')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(me.body.completionPercent).toBe(100);
    });

    it('Step 14: Beneficiary CANNOT approve their own application (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .send({
          applicationId: applicationAId,
          approvedLitres: 35000,
        })
        .expect(403);
    });
  });

  describe('Section 5: Admin Approval Synchronization & 5 Installments', () => {
    it('Step 15: Admin approves 35,000 litres atomically generating bill & 5 installments', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicationId: applicationAId,
          approvedLitres: 35000,
          approvalRemarks: 'Approved as per canal quota allocation',
        })
        .expect(201);

      expect(res.body.allotment_id).toBeDefined();
    });

    it('Step 16: Beneficiary views approved allotment & 5-stage installment milestones', async () => {
      const allotmentsRes = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/allotments')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(allotmentsRes.body.length).toBe(1);
      expect(parseFloat(allotmentsRes.body[0].approved_litres)).toBe(35000);

      const instRes = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/installments')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(instRes.body.installments.length).toBe(5);
      // Total development cost = 35,000 * ₹2.00 = ₹70,000
      expect(parseFloat(instRes.body.totalDevelopmentCost)).toBe(70000);
      // Installment 1 is 2.5% = ₹1,750
      expect(parseFloat(instRes.body.installments[0].percentage)).toBe(2.5);
      expect(parseFloat(instRes.body.installments[0].amount_due)).toBe(1750);
      expect(instRes.body.installments[0].status).toBe('PENDING');
    });
  });

  describe('Section 6: Payment Recording & Receipt Retrieval', () => {
    it('Step 17: Accounts records payment of Installment 1 (₹1,750)', async () => {
      const instRes = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/installments')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      const inst1Id = instRes.body.installments[0].installment_id;

      // Admin or Accounts records payment
      const paymentRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryId: beneficiaryAId,
          installmentId: inst1Id,
          amount: 1750,
          paymentMode: 'BANK_TRANSFER',
          paymentReference: 'NEFT99887766',
          remarks: 'Stage 1 Advance paid',
        })
        .expect(201);

      paymentAId = paymentRes.body.payment_id;
      expect(paymentRes.body.receipt_number).toBeDefined();
    });

    it('Step 18: Beneficiary retrieves printable receipt data for payment', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/beneficiary/receipts/${paymentAId}`)
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(res.body.paymentId).toBe(paymentAId);
      expect(parseFloat(res.body.amount)).toBe(1750);
      expect(res.body.paymentMode).toBe('BANK_TRANSFER');
      expect(res.body.beneficiary.id).toBe(beneficiaryAId);
    });
  });

  describe('Section 7: Infrastructure Lifecycle & Running Charges Gating', () => {
    it('Step 19: Running charges show inactive before infrastructure is commissioned', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/running-bills')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(res.body.isInfrastructureCommissioned).toBe(false);
      expect(res.body.infrastructureStatus).toBe('PLANNED');
    });

    it('Step 20a: FIELD_OFFICER transitions infrastructure to UNDER_CONSTRUCTION and milestone reflects in beneficiary portal', async () => {
      const infra = await prisma.infrastructure.findFirst({
        where: { beneficiary_id: beneficiaryAId },
      });

      const startTestDate = '2026-09-22T08:30:00.000Z';
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/v1/infrastructure/${infra!.infrastructure_id}/status`)
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          status: 'UNDER_CONSTRUCTION',
          date: startTestDate,
          remarks: 'Trenching underway, 110mm HDPE pipe fusion started on site',
        })
        .expect(200);

      expect(patchRes.body.status).toBe('UNDER_CONSTRUCTION');
      expect(patchRes.body.construction_start_date).toBeDefined();

      // Beneficiary views infrastructure page
      const infraRes = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/infrastructure')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(infraRes.body.status).toBe('UNDER_CONSTRUCTION');
      expect(new Date(infraRes.body.construction_start_date).toISOString()).toBe(startTestDate);
      expect(infraRes.body.remarks).toContain('Trenching underway');

      // Beneficiary dashboard reflects updated milestone
      const dashRes = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/dashboard')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(dashRes.body.infrastructure.status).toBe('UNDER_CONSTRUCTION');
      expect(dashRes.body.infrastructure.constructionStartedAt).toBeDefined();
      expect(dashRes.body.runningCharges.isInfrastructureCommissioned).toBe(false);
    });

    it('Step 20b: FIELD_OFFICER transitions infrastructure to COMPLETED', async () => {
      const infra = await prisma.infrastructure.findFirst({
        where: { beneficiary_id: beneficiaryAId },
      });

      const completedDate = '2026-09-22T14:00:00.000Z';
      await request(app.getHttpServer())
        .patch(`/api/v1/infrastructure/${infra!.infrastructure_id}/status`)
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          status: 'COMPLETED',
          date: completedDate,
          remarks: 'Hydrostatic pressure tested at 4.0 bar, zero leakage',
        })
        .expect(200);

      const infraRes = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/infrastructure')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(infraRes.body.status).toBe('COMPLETED');
      expect(infraRes.body.completion_date).toBeDefined();
      expect(infraRes.body.construction_start_date).toBeDefined();
    });

    it('Step 20c: Admin commissions infrastructure and unlocks running charges in beneficiary portal', async () => {
      const infra = await prisma.infrastructure.findFirst({
        where: { beneficiary_id: beneficiaryAId },
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/infrastructure/${infra!.infrastructure_id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'COMMISSIONED',
          remarks: 'Pipeline pressurized and commissioned for live water flow',
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/infrastructure')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(res.body.status).toBe('COMMISSIONED');
      expect(res.body.commissioned_date).toBeDefined();
      expect(res.body.construction_start_date).toBeDefined();
      expect(res.body.completion_date).toBeDefined();

      const runningRes = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/running-bills')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(runningRes.body.isInfrastructureCommissioned).toBe(true);
      expect(runningRes.body.infrastructureStatus).toBe('COMMISSIONED');
    });
  });

  describe('Section 8: Isolated Extension Request', () => {
    it('Step 21: Beneficiary submits quota extension request without mutating original allotment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/beneficiary/extensions')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .send({
          additionalAcres: 1.0,
          additionalLitres: 10000,
          notes: 'Added adjacent parcel SF 202',
        })
        .expect(201);

      expect(res.body.extension_id).toBeDefined();
      expect(res.body.status).toBe('REQUESTED');

      // Original allotment remains strictly 35,000 litres
      const allotmentsRes = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/allotments')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(parseFloat(allotmentsRes.body[0].approved_litres)).toBe(35000);
    });
  });

  describe('Section 9: Strict Cross-Beneficiary Ownership Isolation', () => {
    it('Step 22: Register Beneficiary B', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/beneficiary-signup')
        .send({
          fullName: 'Subramaniam',
          phoneNumber: phoneB,
          email: emailB,
          password: 'Secret@123456',
        })
        .expect(201);

      beneficiaryBToken = res.body.accessToken;
      beneficiaryBId = res.body.beneficiary.beneficiary_id;
    });

    it('Step 23: Beneficiary B CANNOT view Beneficiary A land holding by ID (404 Not Found)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/beneficiary/land/${landAId}`)
        .set('Authorization', `Bearer ${beneficiaryBToken}`)
        .expect(404);
    });

    it('Step 24: Beneficiary B CANNOT access Beneficiary A payment receipt (404 Not Found)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/beneficiary/receipts/${paymentAId}`)
        .set('Authorization', `Bearer ${beneficiaryBToken}`)
        .expect(404);
    });

    it('Step 25: Beneficiary B land list returns 0 holdings (Strict tenant isolation)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/land')
        .set('Authorization', `Bearer ${beneficiaryBToken}`)
        .expect(200);

      expect(res.body.holdings.length).toBe(0);
      expect(parseFloat(res.body.totalActiveAcres)).toBe(0);
    });
  });

  describe('Section 10: Complete Chronological History', () => {
    it('Step 26: Beneficiary views chronological audit trail of all lifecycle events', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/beneficiary/history')
        .set('Authorization', `Bearer ${beneficiaryAToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      // Check that actions such as SUBMIT, CREATE exist
      const actions = res.body.map((item: any) => item.action);
      expect(actions).toContain('SUBMIT');
    });
  });
});
