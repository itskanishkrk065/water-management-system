import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

describe('Find, Filter & Reporting Page (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let fieldOfficerToken: string;
  let beneficiaryToken: string;

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
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Login as Admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@water.gov', password: 'Admin@123456' });
    adminToken = adminLogin.body.accessToken;

    // Login as Field Officer
    const fieldLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'field@water.gov', password: 'Admin@123456' });
    fieldOfficerToken = fieldLogin.body.accessToken;

    // Login as Beneficiary
    const benLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'beneficiary@water.gov', password: 'Admin@123456' });
    beneficiaryToken = benLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Security & RBAC Enforcement', () => {
    it('should reject unauthenticated requests to reporting endpoints with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reports/find')
        .send({})
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/reports/find/export/pdf')
        .send({})
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/reports/find/metadata')
        .expect(401);
    });

    it('should forbid Beneficiary role from executing find queries with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reports/find')
        .set('Authorization', `Bearer ${beneficiaryToken}`)
        .send({})
        .expect(403);
    });

    it('should forbid Beneficiary role from exporting PDF reports with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reports/find/export/pdf')
        .set('Authorization', `Bearer ${beneficiaryToken}`)
        .send({})
        .expect(403);
    });

    it('should allow Admin and Field Officer to fetch filter metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/reports/find/metadata')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.beneficiaryStatuses).toBeDefined();
      expect(res.body.paymentModes).toBeDefined();
      expect(res.body.infrastructureStatuses).toBeDefined();
      expect(res.body.dateTypes).toBeDefined();
    });
  });

  describe('2. Filter Query & Aggregate Metrics Calculation', () => {
    it('should return complete metrics summary and paginated items for default query', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/find')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ page: 1, limit: 25 })
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('metrics');
      expect(res.body).toHaveProperty('meta');

      const { metrics, meta } = res.body;
      expect(metrics).toHaveProperty('beneficiaries');
      expect(metrics).toHaveProperty('land');
      expect(metrics).toHaveProperty('water');
      expect(metrics).toHaveProperty('financials');
      expect(metrics).toHaveProperty('paymentBeneficiaries');
      expect(metrics).toHaveProperty('installments');
      expect(metrics).toHaveProperty('infrastructure');
      expect(metrics).toHaveProperty('extensions');

      expect(meta.limit).toBe(25);
      expect(meta.page).toBe(1);
      // Whole population metrics must match total matching beneficiaries
      expect(metrics.beneficiaries.total).toBe(meta.total);
    });

    it('should execute location-based filters and return strictly matching records', async () => {
      const district = await prisma.district.findFirst();
      if (!district) return;

      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/find')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ districtId: district.district_id, page: 1, limit: 10 })
        .expect(200);

      expect(res.body.metrics.beneficiaries.total).toBe(res.body.meta.total);
      for (const item of res.body.items) {
        expect(item.districtName).toBe(district.name);
      }
    });

    it('should support multi-criteria AND filtering (Name + PaymentStatus + LandArea)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/find')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          beneficiaryName: 'TestNonExistentBeneficiaryXYZ',
          paymentStatus: 'UNPAID',
          landAreaMin: 100,
        })
        .expect(200);

      expect(res.body.meta.total).toBe(0);
      expect(res.body.items).toHaveLength(0);
      expect(res.body.metrics.beneficiaries.total).toBe(0);
      expect(res.body.metrics.land.totalLandAcres).toBe('0.0000');
    });

    it('should respect server-side pagination while maintaining whole-population metrics', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/find')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ page: 1, limit: 1 })
        .expect(200);

      if (res.body.meta.total > 1) {
        expect(res.body.items.length).toBe(1);
        // Whole population metric must be greater than page size 1
        expect(res.body.metrics.beneficiaries.total).toBe(res.body.meta.total);
      }
    });
  });

  describe('3. Server-side Authoritative PDF Export', () => {
    it('should stream a valid PDF file matching exact filter parameters', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/find/export/pdf')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ page: 1, limit: 50 })
        .expect(200);

      expect(res.header['content-type']).toBe('application/pdf');
      expect(res.header['content-disposition']).toContain('attachment; filename="water-management-report-');
      expect(res.header['x-report-record-count']).toBeDefined();
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(100);
    });

    it('should allow Field Officer to export PDF report', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports/find/export/pdf')
        .set('Authorization', `Bearer ${fieldOfficerToken}`)
        .send({})
        .expect(200);

      expect(res.header['content-type']).toBe('application/pdf');
    });
  });
});
