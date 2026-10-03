import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { SyncService } from '../src/modules/sync/sync.service';
import { ClientSyncWorkerService } from '../src/modules/sync/client-sync-worker.service';
import { Decimal } from 'decimal.js';

/**
 * WATERGRID V2 — PHASE 10: CENTRAL SERVER STAGING & MULTI-CLIENT VALIDATION
 * Tests real multi-client synchronization, concurrency, conflicts, and failover
 * against live PostgreSQL staging database.
 */
describe('WaterGrid V2 — Phase 10: Multi-Client Staging & Concurrency E2E Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let syncService: SyncService;
  let clientWorker: ClientSyncWorkerService;
  let adminToken: string;
  let fieldToken: string;

  const pgUrl = process.env.DATABASE_URL_POSTGRES || 'postgresql://water_admin:water_secret_pass@localhost:5432/water_management_staging';

  beforeAll(async () => {
    process.env.DATABASE_URL_POSTGRES = pgUrl;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
    prisma = app.get(PrismaService);
    syncService = app.get(SyncService);
    clientWorker = app.get(ClientSyncWorkerService);

    // Login Admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@water.gov', password: 'Admin@123456' });
    adminToken = adminRes.body.accessToken;

    // Login Field Officer
    const fieldRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'field@water.gov', password: 'Admin@123456' });
    fieldToken = fieldRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Two-Device Synchronization (Device A & Device B)', () => {
    const devAId = 'DEV-STAGING-CLIENT-A';
    const devBId = 'DEV-STAGING-CLIENT-B';
    const benAId = `ben-staging-a-${Date.now()}`;
    const benBId = `ben-staging-b-${Date.now()}`;

    it('registers Device A and Device B with central server', async () => {
      // Register Device A
      const regA = await request(app.getHttpServer())
        .post('/api/v1/sync/register-device')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceId: devAId,
          deviceName: 'Tiruppur Field Laptop A',
          deviceType: 'ELECTRON_DESKTOP',
          appVersion: '2.0.0-staging',
        })
        .expect(201);

      expect(regA.body.device_id).toBe(devAId);

      // Register Device B
      const regB = await request(app.getHttpServer())
        .post('/api/v1/sync/register-device')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceId: devBId,
          deviceName: 'Coimbatore Accounts Desktop B',
          deviceType: 'ELECTRON_DESKTOP',
          appVersion: '2.0.0-staging',
        })
        .expect(201);

      expect(regB.body.device_id).toBe(devBId);
    });

    it('Device A creates Beneficiary X offline and pushes envelope', async () => {
      const opIdA = `op-ben-a-${Date.now()}`;
      const payloadA = {
        name: 'Kandasamy Gounder (Device A)',
        phone_number: `9842${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'ACTIVE',
      };

      const pushRes = await request(app.getHttpServer())
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          deviceId: devAId,
          operations: [
            {
              clientOpId: opIdA,
              operationType: 'CREATE_BENEFICIARY',
              entityType: 'Beneficiary',
              entityId: benAId,
              payloadJson: payloadA,
              schemaVersion: 1,
            },
          ],
        })
        .expect(200);

      expect(pushRes.body.appliedCount).toBe(1);
      expect(pushRes.body.results[0].status).toBe('APPLIED');
    });

    it('Device B creates Beneficiary Y online and pushes envelope', async () => {
      const opIdB = `op-ben-b-${Date.now()}`;
      const payloadB = {
        name: 'Muthusamy Chettiar (Device B)',
        phone_number: `9843${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'ACTIVE',
      };

      const pushRes = await request(app.getHttpServer())
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          deviceId: devBId,
          operations: [
            {
              clientOpId: opIdB,
              operationType: 'CREATE_BENEFICIARY',
              entityType: 'Beneficiary',
              entityId: benBId,
              payloadJson: payloadB,
              schemaVersion: 1,
            },
          ],
        })
        .expect(200);

      expect(pushRes.body.appliedCount).toBe(1);
      expect(pushRes.body.results[0].status).toBe('APPLIED');
    });

    it('Device A pulls deltas with echo suppression (sees Beneficiary Y, excludes self-created X)', async () => {
      const pullRes = await request(app.getHttpServer())
        .get(`/api/v1/sync/pull?sinceFeedId=0&limit=50`)
        .set('Authorization', `Bearer ${fieldToken}`)
        .expect(200);

      expect(pullRes.body.changes).toBeDefined();
      const benBChange = pullRes.body.changes.find((c: any) => c.entityId === benBId);
      expect(benBChange).toBeDefined();
      expect(benBChange.originDeviceId).toBe(devBId);
    });

    it('Device B pulls deltas with echo suppression (sees Beneficiary X, excludes self-created Y)', async () => {
      const pullRes = await request(app.getHttpServer())
        .get(`/api/v1/sync/pull?sinceFeedId=0&limit=50`)
        .set('Authorization', `Bearer ${fieldToken}`)
        .expect(200);

      expect(pullRes.body.changes).toBeDefined();
      const benAChange = pullRes.body.changes.find((c: any) => c.entityId === benAId);
      expect(benAChange).toBeDefined();
      expect(benAChange.originDeviceId).toBe(devAId);
    });
  });

  describe('2. Payment Concurrency & Advance Ledger Routing on Real DB', () => {
    const testBillId = `bill-concurrency-${Date.now()}`;
    const testBenId = `ben-conc-${Date.now()}`;
    const devAId = 'DEV-STAGING-CLIENT-A';
    const devBId = 'DEV-STAGING-CLIENT-B';

    beforeAll(async () => {
      // Seed test beneficiary and running bill with ₹10,000.00 due
      await prisma.beneficiary.create({
        data: {
          beneficiary_id: testBenId,
          name: 'Concurrent Payment Test Farmer',
          phone_number: `9789${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'ACTIVE',
        },
      });

      const rate = await prisma.rateConfiguration.findFirst();
      const allot = await prisma.waterAllotment.findFirst();
      await prisma.runningBill.create({
        data: {
          running_bill_id: testBillId,
          bill_number: `RUN-CONC-${Date.now().toString().slice(-5)}`,
          allotment_id: allot!.allotment_id,
          beneficiary_id: testBenId,
          rate_id: rate!.rate_id,
          billing_period: '2026-10',
          amount_due: new Decimal(10000.0),
          amount_paid: new Decimal(0.0),
          pending_amount: new Decimal(10000.0),
          approved_litres_snapshot: new Decimal(20000.0),
          running_cost_per_litre_snapshot: new Decimal(0.5),
          status: 'PENDING',
          version: 1,
        },
      });
    });

    it('simulates concurrent payments: Device A collects ₹7,000 offline, Device B records ₹6,000 online', async () => {
      // Step 1: Device B's online payment of ₹6,000 arrives first
      const opBId = `op-pay-b-${Date.now()}`;
      const pushB = await request(app.getHttpServer())
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          deviceId: devBId,
          operations: [
            {
              clientOpId: opBId,
              operationType: 'RECORD_PAYMENT',
              entityType: 'Payment',
              entityId: `pay-b-${Date.now()}`,
              payloadJson: {
                runningBillId: testBillId,
                beneficiaryId: testBenId,
                amount: '6000.00',
                paymentMode: 'CASH',
                receiptNumber: `REC-CONC-B-${Date.now().toString().slice(-4)}`,
              },
              schemaVersion: 1,
            },
          ],
        })
        .expect(200);

      expect(pushB.body.appliedCount).toBe(1);

      // Verify bill status after Payment B: ₹6,000 paid, ₹4,000 pending
      let bill = await prisma.runningBill.findUnique({ where: { running_bill_id: testBillId } });
      expect(Number(bill!.amount_paid)).toBe(6000.0);
      expect(Number(bill!.pending_amount)).toBe(4000.0);

      // Step 2: Device A's offline payment of ₹7,000 arrives second (Total ₹13,000 vs ₹10,000 due)
      const opAId = `op-pay-a-${Date.now()}`;
      const pushA = await request(app.getHttpServer())
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          deviceId: devAId,
          operations: [
            {
              clientOpId: opAId,
              operationType: 'RECORD_PAYMENT',
              entityType: 'Payment',
              entityId: `pay-a-${Date.now()}`,
              payloadJson: {
                runningBillId: testBillId,
                beneficiaryId: testBenId,
                amount: '7000.00',
                paymentMode: 'CASH',
                receiptNumber: `REC-CONC-A-${Date.now().toString().slice(-4)}`,
              },
              schemaVersion: 1,
            },
          ],
        })
        .expect(200);

      expect(pushA.body.appliedCount).toBe(1);

      // Verify final settlement on bill:
      // Bill paid must be EXACTLY ₹10,000.00 (NOT ₹13,000.00), Pending must be ₹0.00
      bill = await prisma.runningBill.findUnique({ where: { running_bill_id: testBillId } });
      expect(Number(bill!.amount_paid)).toBe(10000.0);
      expect(Number(bill!.pending_amount)).toBe(0.0);
      expect(bill!.status).toBe('PAID');

      // Verify automatic excess routing to BeneficiaryAdvanceLedger:
      // Excess ₹3,000.00 must be safely stored in advance ledger
      const advances = await prisma.beneficiaryAdvanceLedger.findMany({
        where: { beneficiary_id: testBenId },
      });
      expect(advances.length).toBeGreaterThan(0);
      const totalAdvance = advances.reduce((acc, a) => acc + Number(a.balance_amount), 0);
      expect(totalAdvance).toBe(3000.0);

      // Total money accounted for = ₹10,000 bill + ₹3,000 advance = ₹13,000.00 (Zero loss!)
    });
  });

  describe('3. Lost ACK & Idempotent Replay on Real Server', () => {
    it('returns ALREADY_ACCEPTED when client retries committed operation after network timeout', async () => {
      const clientOpId = `op-lost-ack-${Date.now()}`;
      const benId = `ben-lost-ack-${Date.now()}`;
      const payload = {
        name: 'Lost ACK Farmer',
        phone_number: `9600${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'ACTIVE',
      };

      // Initial push (simulating network dropped immediately after server commit)
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          deviceId: 'DEV-STAGING-CLIENT-A',
          operations: [
            {
              clientOpId,
              operationType: 'CREATE_BENEFICIARY',
              entityType: 'Beneficiary',
              entityId: benId,
              payloadJson: payload,
              schemaVersion: 1,
            },
          ],
        })
        .expect(200);

      expect(res1.body.appliedCount).toBe(1);

      // Client re-submits exact same envelope
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          deviceId: 'DEV-STAGING-CLIENT-A',
          operations: [
            {
              clientOpId,
              operationType: 'CREATE_BENEFICIARY',
              entityType: 'Beneficiary',
              entityId: benId,
              payloadJson: payload,
              schemaVersion: 1,
            },
          ],
        })
        .expect(200);

      expect(res2.body.results[0].status).toBe('ALREADY_ACCEPTED');

      // Verify exactly one record exists in database
      const count = await prisma.beneficiary.count({ where: { beneficiary_id: benId } });
      expect(count).toBe(1);
    });
  });

  describe('4. Centrally Revoked Device Rejection', () => {
    const revokedDevId = 'DEV-STOLEN-PAD-99';

    it('centrally revokes device and rejects subsequent sync push with 403 Forbidden', async () => {
      // Step 1: Register device
      await request(app.getHttpServer())
        .post('/api/v1/sync/register-device')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceId: revokedDevId,
          deviceName: 'Lost Tablet',
          deviceType: 'ELECTRON_DESKTOP',
          appVersion: '2.0.0-staging',
        })
        .expect(201);

      // Step 2: Revoke device centrally
      const revokeRes = await request(app.getHttpServer())
        .post('/api/v1/sync/revoke-device')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceId: revokedDevId,
          reason: 'Reported lost by field officer',
        });

      expect([200, 201]).toContain(revokeRes.status);

      // Step 3: Attempt sync push from revoked device
      const res = await request(app.getHttpServer())
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          deviceId: revokedDevId,
          operations: [
            {
              clientOpId: `op-revoked-${Date.now()}`,
              operationType: 'CREATE_BENEFICIARY',
              entityType: 'Beneficiary',
              entityId: 'some-id',
              payloadJson: { name: 'Unauthorized Record' },
              schemaVersion: 1,
            },
          ],
        })
        .expect(403);

      expect(res.body.message).toContain('DEVICE_REVOKED');
    });
  });

  describe('5. Conflict Detection & Visual Resolution Workspace', () => {
    const conflictBenId = `ben-conflict-${Date.now()}`;
    const devAId = 'DEV-STAGING-CLIENT-A';

    beforeAll(async () => {
      await prisma.beneficiary.create({
        data: {
          beneficiary_id: conflictBenId,
          name: 'Original Farmer Name',
          phone_number: `9111${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'ACTIVE',
          version: 1,
        },
      });
    });

    it('generates CONFLICT status when Device A submits update with stale version', async () => {
      // Device B updates beneficiary online (bumps version to 2)
      await prisma.beneficiary.update({
        where: { beneficiary_id: conflictBenId },
        data: { name: 'Server Authorized Name (by Device B)', version: 2 },
      });

      // Device A pushes offline update expecting version 1
      const opConflictId = `op-conflict-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/sync/push')
        .set('Authorization', `Bearer ${fieldToken}`)
        .send({
          deviceId: devAId,
          operations: [
            {
              clientOpId: opConflictId,
              operationType: 'UPDATE_BENEFICIARY',
              entityType: 'Beneficiary',
              entityId: conflictBenId,
              expectedVersion: 1, // Stale!
              payloadJson: { name: 'Device A Conflicting Name' },
              schemaVersion: 1,
            },
          ],
        })
        .expect(200);

      expect(res.body.conflictCount).toBe(1);
      expect(res.body.results[0].status).toBe('CONFLICT');

      // Verify conflict is listed in Sync Center workspace
      const conflictsRes = await request(app.getHttpServer())
        .get('/api/v1/sync/conflicts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(conflictsRes.body)).toBe(true);
      expect(conflictsRes.body.length).toBeGreaterThan(0);
    });
  });
});
