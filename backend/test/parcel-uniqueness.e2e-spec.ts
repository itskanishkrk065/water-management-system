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

describe('Land Parcel Uniqueness & Duplicate Validation E2E Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  let districtId: string;
  let blockId: string;
  let villageId: string;
  let projectId: string;
  let testBeneficiaryId: string;

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
      include: { block: true },
    });
    villageId = v.village_id;
    blockId = v.block_id || null;
    districtId = v.block?.district_id || (await prisma.district.findFirst()).district_id;

    const p = await prisma.project.findFirst({ where: { status: 'ACTIVE' } });
    projectId = p ? p.project_id : (await prisma.project.findFirst()).project_id;

    // Create test beneficiary
    const benRes = await request(app.getHttpServer())
      .post('/api/v1/beneficiaries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Uniqueness Test Farmer',
        phoneNumber: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
        addressLine1: 'Survey Plot 100, West Bank',
        pincode: '642001',
        districtId,
        blockId,
        villageId,
        locationDirection: 'WEST',
      })
      .expect(201);
    testBeneficiaryId = benRes.body.beneficiary_id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('TEST 1: Same survey, different subdivisions (s1/1A + s1/1B) -> MUST SUCCEED (201 Created)', async () => {
    const s1 = `S${Math.floor(100000 + Math.random() * 900000)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/land/holdings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: testBeneficiaryId,
        projectId,
        declaredTotalArea: 5.7,
        parcels: [
          { surveyNumber: s1, subdivisionNumber: '1A', area: 2.7 },
          { surveyNumber: s1, subdivisionNumber: '1B', area: 3.0 },
        ],
      })
      .expect(201);

    expect(res.body.land_id).toBeDefined();
    expect(res.body.parcels).toHaveLength(2);
    expect(res.body.parcels[0].survey_number).toBe(s1);
    expect(res.body.parcels[0].subdivision_number).toBe('1A');
    expect(res.body.parcels[1].survey_number).toBe(s1);
    expect(res.body.parcels[1].subdivision_number).toBe('1B');
  });

  it('TEST 2: Different survey, same subdivision (s2a/1A + s2b/1A) -> MUST SUCCEED (201 Created)', async () => {
    const s2a = `S${Math.floor(100000 + Math.random() * 900000)}`;
    const s2b = `S${Math.floor(100000 + Math.random() * 900000)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/land/holdings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: testBeneficiaryId,
        projectId,
        declaredTotalArea: 5.0,
        parcels: [
          { surveyNumber: s2a, subdivisionNumber: '1A', area: 2.5 },
          { surveyNumber: s2b, subdivisionNumber: '1A', area: 2.5 },
        ],
      })
      .expect(201);

    expect(res.body.land_id).toBeDefined();
    expect(res.body.parcels).toHaveLength(2);
  });

  it('TEST 3: Duplicate survey + subdivision (s3/1A + s3/1A) on same holding -> MUST BE REJECTED (400 Bad Request)', async () => {
    const s3 = `S${Math.floor(100000 + Math.random() * 900000)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/land/holdings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: testBeneficiaryId,
        projectId,
        declaredTotalArea: 5.0,
        parcels: [
          { surveyNumber: s3, subdivisionNumber: '1A', area: 2.5 },
          { surveyNumber: s3, subdivisionNumber: '1A', area: 2.5 },
        ],
      })
      .expect(400);

    expect(res.body.message).toContain('Duplicate parcel detected');
  });

  it('TEST 4: Duplicate survey + subdivision with leading/trailing whitespace & mixed case -> MUST BE REJECTED (400 Bad Request)', async () => {
    const s4 = `S${Math.floor(100000 + Math.random() * 900000)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/land/holdings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: testBeneficiaryId,
        projectId,
        declaredTotalArea: 5.0,
        parcels: [
          { surveyNumber: s4, subdivisionNumber: '1A', area: 2.5 },
          { surveyNumber: ` ${s4} `, subdivisionNumber: ' 1a ', area: 2.5 },
        ],
      })
      .expect(400);

    expect(res.body.message).toContain('Duplicate parcel detected');
  });

  it('TEST 5: Attempting to register already registered parcel on another holding -> MUST BE REJECTED (400 Bad Request)', async () => {
    const s5 = `S${Math.floor(100000 + Math.random() * 900000)}`;
    await request(app.getHttpServer())
      .post('/api/v1/land/holdings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: testBeneficiaryId,
        projectId,
        declaredTotalArea: 2.7,
        parcels: [
          { surveyNumber: s5, subdivisionNumber: '1A', area: 2.7 },
        ],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/land/holdings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: testBeneficiaryId,
        projectId,
        declaredTotalArea: 2.7,
        parcels: [
          { surveyNumber: s5, subdivisionNumber: '1A', area: 2.7 },
        ],
      })
      .expect(400);

    expect(res.body.message).toContain('already registered');
  });

  it('TEST 6: Edit holding with non-duplicate parcel -> MUST SUCCEED (200 OK)', async () => {
    const s6 = `S${Math.floor(100000 + Math.random() * 900000)}`;
    // 1. Create valid holding with s6/1A (2.5) and s6/1B (2.5)
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/land/holdings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        beneficiaryId: testBeneficiaryId,
        projectId,
        declaredTotalArea: 5.0,
        parcels: [
          { surveyNumber: s6, subdivisionNumber: '1A', area: 2.5 },
          { surveyNumber: s6, subdivisionNumber: '1B', area: 2.5 },
        ],
      })
      .expect(201);
    const holdingId = createRes.body.land_id;

    // 2. Update s6/1B to s6/1C (valid new subdivision)
    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/land/holdings/${holdingId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        declaredTotalArea: 5.0,
        parcels: [
          { surveyNumber: s6, subdivisionNumber: '1A', area: 2.5 },
          { surveyNumber: s6, subdivisionNumber: '1C', area: 2.5 },
        ],
      })
      .expect(200);

    expect(updateRes.body.parcels).toHaveLength(2);
    expect(updateRes.body.parcels.some((p: any) => p.subdivision_number === '1C')).toBe(true);
  });

  it('TEST 7: Complete Onboarding with duplicate parcels in holding -> MUST ROLLBACK TRANSACTION (400 Bad Request)', async () => {
    const badPhone = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/beneficiaries/complete-onboarding')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Atomic Rollback Test Farmer',
        phoneNumber: badPhone,
        pincode: '642001',
        addressLine1: 'Canal Bank 404',
        districtId,
        villageId,
        locationDirection: 'SOUTH',
        holdings: [
          {
            projectId,
            declaredTotalArea: 5.0,
            parcels: [
              { surveyNumber: '701', subdivisionNumber: '1A', area: 2.5 },
              { surveyNumber: '701', subdivisionNumber: '1A', area: 2.5 }, // Duplicate!
            ],
          },
        ],
      })
      .expect(400);

    expect(res.body.message).toContain('Duplicate parcel detected');

    // Confirm that the beneficiary was NOT created (rollback guarantee)
    const checkBen = await prisma.beneficiary.findFirst({
      where: { phone_number: badPhone },
    });
    expect(checkBen).toBeNull();
  });
});
