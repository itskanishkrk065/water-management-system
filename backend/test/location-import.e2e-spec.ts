import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

describe('Location Master Import & Cascading Hierarchy (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let beneficiaryToken: string;
  let fieldOfficerToken: string;

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

  describe('1. Security & RBAC for Location Import', () => {
    it('should forbid non-admin (beneficiary) from uploading location files', async () => {
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet([['Dummy']]);
      xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      await request(app.getHttpServer())
        .post('/api/v1/admin/location-import')
        .set('Authorization', `Bearer ${beneficiaryToken}`)
        .attach('file', buffer, 'test.xlsx')
        .expect(403);
    });

    it('should forbid non-admin (field officer) from confirming imports', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/location-import/fake-uuid/confirm')
        .set('Authorization', `Bearer ${fieldOfficerToken}`)
        .expect(403);
    });
  });

  describe('2. Excel Validation & Preview', () => {
    it('should reject Excel file with missing required columns and explain which is missing', async () => {
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet([
        ['LGD District Code', 'District Name', 'LGD Block code', 'Block Name', 'Village Name'],
        [528, 'KANCHEEPURAM', 6482, 'KANCHEEPURAM', 'Angambakkam'],
      ]);
      xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/location-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buffer, 'missing_cols.xlsx')
        .expect(400);

      expect(res.body.message).toMatch(/Missing required column.*LGD Village Code/i);
    });

    it('should successfully parse official or sample LGD Excel file and return preview', async () => {
      const sampleRows = [
        ['LGD District Code', 'District Name', 'LGD Block code', 'Block Name', 'LGD Village Code', 'Village Name'],
        [528, 'KANCHEEPURAM', 6482, 'KANCHEEPURAM', 223994, 'Angambakkam'],
        [528, 'KANCHEEPURAM', 6482, 'KANCHEEPURAM', 223995, 'Ariyaperumpakkam'],
        [528, 'KANCHEEPURAM', 6483, 'WALAJABAD', 223996, 'Arpaakkam'],
        [600, 'TIRUPPUR', 6500, 'AVINASHI', 225000, 'Alathur'],
      ];
      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.aoa_to_sheet(sampleRows);
      xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/location-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buffer, 'lgd_sample.xlsx')
        .expect(201);

      expect(res.body.totalRows).toBe(4);
      expect(res.body.validRows).toBe(4);
      expect(res.body.invalidRows).toBe(0);
      expect(res.body.newDistricts + res.body.existingDistricts).toBeGreaterThanOrEqual(2);
      expect(res.body.newBlocks + res.body.existingBlocks).toBeGreaterThanOrEqual(2);
      expect(res.body.importId).toBeDefined();

      // Step 2: Confirm the import
      const confirmRes = await request(app.getHttpServer())
        .post(`/api/v1/admin/location-import/${res.body.importId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(confirmRes.body.status).toBe('IMPORTED');
      expect(confirmRes.body.summary.villagesCreated + confirmRes.body.summary.villagesUpdated).toBeGreaterThanOrEqual(4);
    });
  });

  describe('3. Cascading Dropdown Hierarchy Endpoints', () => {
    it('should return districts, then blocks for selected district, then villages for selected block', async () => {
      // 1. Get districts
      const distRes = await request(app.getHttpServer())
        .get('/api/v1/locations/districts')
        .set('Authorization', `Bearer ${beneficiaryToken}`)
        .expect(200);

      expect(Array.isArray(distRes.body)).toBe(true);
      expect(distRes.body.length).toBeGreaterThan(0);

      const targetDistrict = distRes.body.find((d: any) => d._count?.blocks > 0) || distRes.body[0];
      expect(targetDistrict.district_id).toBeDefined();

      // 2. Get blocks for district
      const blockRes = await request(app.getHttpServer())
        .get(`/api/v1/locations/districts/${targetDistrict.district_id}/blocks`)
        .set('Authorization', `Bearer ${beneficiaryToken}`)
        .expect(200);

      expect(Array.isArray(blockRes.body)).toBe(true);
      expect(blockRes.body.length).toBeGreaterThan(0);
      const targetBlock = blockRes.body[0];

      // 3. Get villages for block
      const vilRes = await request(app.getHttpServer())
        .get(`/api/v1/locations/blocks/${targetBlock.block_id}/villages?page=1&limit=20`)
        .set('Authorization', `Bearer ${beneficiaryToken}`)
        .expect(200);

      expect(vilRes.body.items).toBeDefined();
      expect(vilRes.body.meta).toBeDefined();
      expect(vilRes.body.meta.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('4. Backend Location Hierarchy Mismatch Validation', () => {
    it('should reject beneficiary registration when block does not belong to district', async () => {
      const districts = await prisma.district.findMany({ take: 2 });
      if (districts.length < 2) return;

      const blocksForDist0 = await prisma.block.findMany({ where: { district_id: districts[0].district_id } });
      const villagesForDist0 = await prisma.village.findMany({ where: { block_id: blocksForDist0[0]?.block_id } });

      if (blocksForDist0.length > 0 && villagesForDist0.length > 0) {
        // Submit district[1] but block from district[0] -> MISMATCH
        const res = await request(app.getHttpServer())
          .post('/api/v1/beneficiaries')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Mismatch Test Farmer',
            phoneNumber: '9998887771',
            addressLine1: 'Test Farm Road',
            districtId: districts[1].district_id, // Mismatched district!
            blockId: blocksForDist0[0].block_id,
            villageId: villagesForDist0[0].village_id,
            pincode: '600001',
            locationDirection: 'NORTH',
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Location mismatch|does not belong/i);
      }
    });
  });
});
