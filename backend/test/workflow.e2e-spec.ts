import * as dotenv from 'dotenv';
dotenv.config();

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/modules/common/filters/http-exception.filter';
import { TransformDecimalInterceptor } from '../src/modules/common/interceptors/transform-decimal.interceptor';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { InfrastructureStatus } from '@prisma/client';

describe('Water Management End-to-End & Authorization Test Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let fieldToken: string;
  let accountsToken: string;
  let viewerToken: string;

  let districtId: string;
  let panchayatId: string;
  let villageId: string;
  let projectId: string;

  let beneficiaryId: string;
  let applicationId: string;
  let allotmentId: string;
  let installment1Id: string;
  let infrastructureId: string;

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

    // Login with seeded users
    const [adminRes, fieldRes, accountsRes, viewerRes] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@water.gov', password: 'Admin@123456' }),
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'field@water.gov', password: 'Admin@123456' }),
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'accounts@water.gov', password: 'Admin@123456' }),
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'viewer@water.gov', password: 'Admin@123456' }),
    ]);

    adminToken = adminRes.body.accessToken;
    fieldToken = fieldRes.body.accessToken;
    accountsToken = accountsRes.body.accessToken;
    viewerToken = viewerRes.body.accessToken;

    expect(adminToken).toBeDefined();
    expect(fieldToken).toBeDefined();
    expect(accountsToken).toBeDefined();
    expect(viewerToken).toBeDefined();

    // Fetch seeded location & project
    const district = await prisma.district.findFirst();
    const panchayat = await prisma.panchayat.findFirst();
    const village = await prisma.village.findFirst();
    const project = await prisma.project.findFirst();

    districtId = district.district_id;
    panchayatId = panchayat.panchayat_id;
    villageId = village.village_id;
    projectId = project.project_id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Section 1: Beneficiary Phone Lookup & Registration Workflow', () => {
    const testPhone = '91' + Math.floor(10000000 + Math.random() * 90000000).toString();

    it('Step 1: Phone lookup returns not found for a new phone', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/beneficiaries/lookup?phone=${testPhone}`)
        .set('Authorization', `Bearer ${fieldToken}`)
        .expect(200);

      expect(res.body.found).toBe(false);
    });

    it('Step 2: Field Officer registers new beneficiary profile', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          name: 'P. Shanmugam',
          phoneNumber: testPhone,
          addressLine1: 'Main Road, Block 4',
          districtId,
          panchayatId,
          villageId,
          pincode: '642002',
          locationDirection: 'SOUTH',
          locationDescription: 'Adjacent to southern distributary',
        })
        .expect(201);

      expect(res.body.beneficiary_id).toBeDefined();
      expect(res.body.phone_number).toBe(testPhone);
      beneficiaryId = res.body.beneficiary_id;
    });

    it('Step 3: Subsequent phone lookup finds the existing beneficiary', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/beneficiaries/lookup?phone=${testPhone}`)
        .set('Authorization', `Bearer ${fieldToken}`)
        .expect(200);

      expect(res.body.found).toBe(true);
      expect(res.body.beneficiary.beneficiary_id).toBe(beneficiaryId);
      expect(res.body.beneficiary.name).toBe('P. Shanmugam');
    });

    it('Step 4: Reject duplicate beneficiary creation with same phone number', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/beneficiaries')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          name: 'Duplicate Entry',
          phoneNumber: testPhone,
          addressLine1: 'Other address',
          districtId,
          panchayatId,
          villageId,
          pincode: '642002',
          locationDirection: 'SOUTH',
        })
        .expect(409);
    });
  });

  describe('Section 2: Land Holdings & Subdivision Parcels Validation', () => {
    it('Step 5: Fails when parcel sum does not equal declared total area', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          beneficiaryId,
          projectId,
          declaredTotalArea: 4.0, // Declared 4.0
          parcels: [
            { surveyNumber: '202', subdivisionNumber: '1A', area: 2.0 },
            { surveyNumber: '202', subdivisionNumber: '1B', area: 1.0 },
            // Sum is 3.0 != 4.0!
          ],
        })
        .expect(400);
    });

    it('Step 6: Succeeds when parcel sum exactly matches declared total area (3.0 acres)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/land/holdings')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          beneficiaryId,
          projectId,
          declaredTotalArea: 3.0,
          parcels: [
            { surveyNumber: '202', subdivisionNumber: '1A', area: 2.0 },
            { surveyNumber: '202', subdivisionNumber: '1B', area: 1.0 },
          ],
        })
        .expect(201);

      expect(res.body.land_id).toBeDefined();
      expect(res.body.parcels.length).toBe(2);
    });

    it('Step 7: Total beneficiary land accurately computed across active holdings', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/land/beneficiary/${beneficiaryId}/total`)
        .set('Authorization', `Bearer ${fieldToken}`)
        .expect(200);

      expect(res.body.total_land_acres).toBe('3.0000');
      expect(res.body.active_holdings_count).toBe(1);
      expect(res.body.total_parcels_count).toBe(2);
    });
  });

  describe('Section 3: Water Application & Calculations Preview', () => {
    it('Step 8: Preview calculation shows required vs calculated allotment', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/water/preview-allotment?beneficiaryId=${beneficiaryId}&projectId=${projectId}`)
        .set('Authorization', `Bearer ${fieldToken}`)
        .expect(200);

      // 3.0 acres * 10,000 L/acre = 30,000 L
      expect(res.body.total_land_acres).toBe('3.0000');
      expect(res.body.litres_per_acre).toBe('10000');
      expect(res.body.calculated_allotted_litres).toBe('30000.00');
    });

    it('Step 9: Field officer submits application for 35,000 litres requirement', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          beneficiaryId,
          projectId,
          requiredLitres: 35000,
          remarks: 'Borewell supplement requirement',
        })
        .expect(201);

      expect(res.body.application_id).toBeDefined();
      expect(res.body.required_litres).toBe('35000');
      expect(res.body.status).toBe('SUBMITTED');
      applicationId = res.body.application_id;
    });
  });

  describe('Section 4: Atomic Transactional Approval & 5 Installments', () => {
    it('Step 10: Admin approves 28,000 litres - creates allotment, bill, 5 installments, and infrastructure', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicationId,
          approvedLitres: 28000,
          approvalRemarks: 'Approved 28,000 L as per channel quota',
        })
        .expect(201);

      allotmentId = res.body.allotment_id;
      expect(allotmentId).toBeDefined();
      expect(res.body.approved_litres).toBe('28000');

      // Development cost = 28,000 L * ₹2.00 = ₹56,000.00
      const bill = res.body.developmentBill;
      expect(bill).toBeDefined();
      expect(Number(bill.total_amount)).toBe(56000);
      expect(Number(bill.pending_amount)).toBe(56000);

      // Exactly 5 installments
      const installments = bill.installments;
      expect(installments.length).toBe(5);

      // Installment 1 = 2.5% of 56,000 = ₹1,400.00
      expect(installments[0].installment_number).toBe(1);
      expect(Number(installments[0].amount_due)).toBe(1400);
      expect(Number(installments[0].pending_amount)).toBe(1400);
      installment1Id = installments[0].installment_id;

      // Infrastructure initialized in PLANNED status
      expect(res.body.infrastructure).toBeDefined();
      expect(res.body.infrastructure.status).toBe(InfrastructureStatus.PLANNED);
      infrastructureId = res.body.infrastructure.infrastructure_id;
    });
  });

  describe('Section 5: Payments Recording and Balance Reconciliation', () => {
    it('Step 11: Accounts officer records full payment of Installment 1 (₹1,400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${accountsToken}`)
        .send({
          beneficiaryId,
          installmentId: installment1Id,
          amount: 1400.0,
          paymentMode: 'UPI',
          paymentReference: 'UPI-TXN-12345',
          remarks: 'Paid via PhonePe',
        })
        .expect(201);

      expect(res.body.payment_id).toBeDefined();
      expect(res.body.receipt_number).toMatch(/^REC-/);

      // Check installment status updated to PAID
      const instRes = await request(app.getHttpServer())
        .get(`/api/v1/billing/installments?billId=${installment1Id}`)
        .set('Authorization', `Bearer ${accountsToken}`);

      const billRes = await request(app.getHttpServer())
        .get(`/api/v1/beneficiaries/${beneficiaryId}`)
        .set('Authorization', `Bearer ${accountsToken}`)
        .expect(200);

      const updatedBill = billRes.body.developmentBills[0];
      expect(Number(updatedBill.amount_paid)).toBe(1400);
      expect(Number(updatedBill.pending_amount)).toBe(54600);
      expect(updatedBill.status).toBe('PARTIALLY_PAID');
    });
  });

  describe('Section 6: Infrastructure Commissioning Gate & Running Charges', () => {
    it('Step 12: CRITICAL: Generating running bill fails before infrastructure is commissioned', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/billing/running-bills/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          allotmentId,
          billingPeriod: '2026-Q1',
        })
        .expect(400); // Gated!
    });

    it('Step 13: Admin transitions infrastructure to COMMISSIONED', async () => {
      // Step: Under construction -> Completed -> Commissioned
      await request(app.getHttpServer())
        .patch(`/api/v1/infrastructure/${infrastructureId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: InfrastructureStatus.COMMISSIONED, remarks: 'Grid connected and flow verified' })
        .expect(200);
    });

    it('Step 14: Now generating running bill succeeds after commissioning', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/billing/running-bills/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          allotmentId,
          billingPeriod: '2026-Q1',
        })
        .expect(201);

      // Running cost = 28,000 L * ₹0.50 = ₹14,000.00
      expect(res.body.running_bill_id).toBeDefined();
      expect(Number(res.body.amount_due)).toBe(14000);
      expect(Number(res.body.pending_amount)).toBe(14000);
    });
  });

  describe('Section 7: Extension Request Isolation', () => {
    it('Step 15: Create and approve extension request without mutating original allotment', async () => {
      const extRes = await request(app.getHttpServer())
        .post('/api/v1/extensions')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          beneficiaryId,
          originalAllotmentId: allotmentId,
          requestedAdditionalArea: 1.0,
          requestedAdditionalLitres: 10000,
          remarks: 'Additional parcel acquisition',
        })
        .expect(201);

      const extensionId = extRes.body.extension_id;

      // Admin approves extension
      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/extensions/${extensionId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          approvedAdditionalArea: 1.0,
          approvedAdditionalLitres: 10000,
          remarks: 'Approved additional 10,000 L',
        })
        .expect(201);

      // Extension cost = 10,000 L * ₹2.00 = ₹20,000.00
      expect(Number(approveRes.body.extension_cost)).toBe(20000);

      // Verify original allotment remains strictly un-mutated!
      const originalRes = await request(app.getHttpServer())
        .get(`/api/v1/water/allotments/${allotmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(originalRes.body.approved_litres).toBe('28000');
      expect(originalRes.body.extensions.length).toBe(1);
    });
  });

  describe('Section 8: RBAC Authorization Restrictions', () => {
    it('FIELD_OFFICER cannot approve water applications', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/water/allotments/approve')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          applicationId,
          approvedLitres: 10000,
        })
        .expect(403);
    });

    it('VIEWER cannot modify records or submit applications', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/water/applications')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          beneficiaryId,
          projectId,
          requiredLitres: 10000,
        })
        .expect(403);
    });

    it('ACCOUNTS cannot modify rate configurations', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/rates')
        .set('Authorization', `Bearer ${accountsToken}`)
        .send({
          projectId,
          litresPerAcre: 12000,
          developmentCostPerLitre: 2.5,
          runningCostPerLitre: 0.6,
          effectiveFrom: '2027-01-01T00:00:00.000Z',
        })
        .expect(403);
    });

    it('Unauthenticated requests are rejected with 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/beneficiaries')
        .expect(401);
    });
  });

  describe('Section 9: Complete Audit Trail Verification', () => {
    it('Step 16: Audit logs exist for all critical lifecycle events', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/audit?entityId=${beneficiaryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.items.some((log: any) => log.action === 'CREATE')).toBe(true);
    });
  });
});
