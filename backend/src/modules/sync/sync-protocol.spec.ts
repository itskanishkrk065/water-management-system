import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { SyncConflictService } from './sync-conflict.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApplicationClockService } from '../system/application-clock.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

describe('WaterGrid V2 — Server Synchronization Engine & Idempotency Protocol (SYNC-001 to SYNC-050)', () => {
  let syncService: SyncService;
  let conflictService: SyncConflictService;

  // In-memory mock database state
  const mockDevices = new Map<string, any>();
  const mockSyncOps = new Map<string, any>();
  const mockFeed: any[] = [];
  const mockBeneficiaries = new Map<string, any>();
  const mockRunningBills = new Map<string, any>();
  const mockPayments = new Map<string, any>();
  const mockAdvances = new Map<string, any>();

  const mockPrisma: any = {
    deviceRegistration: {
      findUnique: jest.fn(async ({ where }) => mockDevices.get(where.device_id) || null),
      upsert: jest.fn(async ({ where, create, update }) => {
        const existing = mockDevices.get(where.device_id);
        const data = existing ? { ...existing, ...update } : { ...create };
        mockDevices.set(where.device_id, data);
        return data;
      }),
      update: jest.fn(async ({ where, data }) => {
        const existing = mockDevices.get(where.device_id);
        if (!existing) throw new NotFoundException();
        const updated = { ...existing, ...data };
        mockDevices.set(where.device_id, updated);
        return updated;
      }),
    },
    syncOperation: {
      findUnique: jest.fn(async ({ where }) => mockSyncOps.get(where.client_op_id) || null),
      create: jest.fn(async ({ data }) => {
        mockSyncOps.set(data.client_op_id, data);
        return data;
      }),
    },
    serverChangeFeed: {
      findFirst: jest.fn(async () => {
        if (mockFeed.length === 0) return null;
        return mockFeed[mockFeed.length - 1];
      }),
      findMany: jest.fn(async ({ where, take }) => {
        const sinceId = where?.feed_id?.gt || 0;
        const filtered = mockFeed.filter((f) => f.feed_id > sinceId);
        return filtered.slice(0, take || 100);
      }),
      create: jest.fn(async ({ data }) => {
        const entry = { ...data, feed_id: mockFeed.length + 1, created_at: new Date() };
        mockFeed.push(entry);
        return entry;
      }),
    },
    beneficiary: {
      findUnique: jest.fn(async ({ where }) => mockBeneficiaries.get(where.beneficiary_id) || null),
      update: jest.fn(async ({ where, data }) => {
        const existing = mockBeneficiaries.get(where.beneficiary_id) || { beneficiary_id: where.beneficiary_id, version: 1 };
        const newVer = data.version?.increment ? (existing.version || 1) + 1 : (data.version || existing.version);
        const updated = { ...existing, ...data, version: newVer };
        mockBeneficiaries.set(where.beneficiary_id, updated);
        return updated;
      }),
    },
    runningBill: {
      findUnique: jest.fn(async ({ where }) => mockRunningBills.get(where.running_bill_id) || null),
      update: jest.fn(async ({ where, data }) => {
        const existing = mockRunningBills.get(where.running_bill_id);
        const newVer = data.version?.increment ? (existing.version || 1) + 1 : (data.version || existing.version);
        const updated = { ...existing, ...data, version: newVer };
        mockRunningBills.set(where.running_bill_id, updated);
        return updated;
      }),
    },
    payment: {
      create: jest.fn(async ({ data }) => {
        const p = { ...data, payment_id: `pay-${mockPayments.size + 1}` };
        mockPayments.set(p.payment_id, p);
        return p;
      }),
    },
    beneficiaryAdvanceLedger: {
      create: jest.fn(async ({ data }) => {
        const adv = { ...data, advance_id: `adv-${mockAdvances.size + 1}` };
        mockAdvances.set(adv.advance_id, adv);
        return adv;
      }),
    },
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    mockDevices.clear();
    mockSyncOps.clear();
    mockFeed.length = 0;
    mockBeneficiaries.clear();
    mockRunningBills.clear();
    mockPayments.clear();
    mockAdvances.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        SyncConflictService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: ApplicationClockService, useValue: null },
      ],
    }).compile();

    syncService = module.get<SyncService>(SyncService);
    conflictService = module.get<SyncConflictService>(SyncConflictService);

    jest.clearAllMocks();
  });

  describe('SYNC-001: Device Registration & Status', () => {
    it('registers an edge device and returns active sync status', async () => {
      const reg = await syncService.registerDevice({
        deviceId: 'tablet-coimbatore-01',
        deviceName: 'Coimbatore Field Tablet A',
        appVersion: '2.0.0-rc1',
      });

      expect(reg.device_id).toBe('tablet-coimbatore-01');
      expect(reg.is_active).toBe(true);

      const status = await syncService.getSyncStatus('tablet-coimbatore-01');
      expect(status.serverTime).toBeDefined();
      expect(status.device.isActive).toBe(true);
      expect(status.device.deviceId).toBe('tablet-coimbatore-01');
    });
  });

  describe('SYNC-002: Device Revocation Blocks Sync', () => {
    it('rejects push requests from a revoked device', async () => {
      await syncService.registerDevice({
        deviceId: 'tablet-lost-02',
        deviceName: 'Lost Tablet',
        appVersion: '2.0.0',
      });

      await syncService.revokeDevice({
        deviceId: 'tablet-lost-02',
        reason: 'Device reported stolen in the field',
      });

      await expect(
        syncService.processPush({
          deviceId: 'tablet-lost-02',
          operations: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SYNC-010: Idempotent Push Processing', () => {
    it('returns ALREADY_ACCEPTED when duplicate clientOpId is submitted with identical payload', async () => {
      await syncService.registerDevice({
        deviceId: 'dev-01',
        deviceName: 'Device 01',
        appVersion: '2.0.0',
      });

      const envelope = {
        clientOpId: 'op-uuid-1001',
        operationType: 'UPDATE_BENEFICIARY',
        entityType: 'Beneficiary',
        entityId: 'ben-1001',
        payloadJson: { name: 'Kandasamy Gounder Updated', phoneNumber: '9842100001' },
        schemaVersion: 1,
      };

      // 1. First Push
      const res1 = await syncService.processPush({
        deviceId: 'dev-01',
        operations: [envelope],
      });

      expect(res1.appliedCount).toBe(1);
      expect(res1.results[0].status).toBe('APPLIED');
      expect(mockFeed.length).toBe(1);

      // 2. Second Push (Re-sent after network disconnect)
      const res2 = await syncService.processPush({
        deviceId: 'dev-01',
        operations: [envelope],
      });

      expect(res2.appliedCount).toBe(0);
      expect(res2.alreadyAcceptedCount).toBe(1);
      expect(res2.results[0].status).toBe('ALREADY_ACCEPTED');
      expect(mockFeed.length).toBe(1); // Not duplicated in change feed!
    });
  });

  describe('SYNC-014: Tampered Payload Detection', () => {
    it('rejects with IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_PAYLOAD when operationId reused with altered payload', async () => {
      await syncService.registerDevice({
        deviceId: 'dev-02',
        deviceName: 'Device 02',
        appVersion: '2.0.0',
      });

      const initialEnvelope = {
        clientOpId: 'op-uuid-1014',
        operationType: 'RECORD_PAYMENT',
        entityType: 'Payment',
        entityId: 'pay-01',
        payloadJson: { amount: 5000, receiptNumber: 'REC-01' },
      };

      // Apply initial operation
      await syncService.processPush({
        deviceId: 'dev-02',
        operations: [initialEnvelope],
      });

      // Submit identical clientOpId but tampered amount
      const tamperedEnvelope = {
        ...initialEnvelope,
        payloadJson: { amount: 15000, receiptNumber: 'REC-01' },
      };

      const res = await syncService.processPush({
        deviceId: 'dev-02',
        operations: [tamperedEnvelope],
      });

      expect(res.rejectedCount).toBe(1);
      expect(res.results[0].status).toBe('REJECTED');
      expect(res.results[0].code).toBe('IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_PAYLOAD');
    });
  });

  describe('SYNC-020: Optimistic Concurrency Version Conflict', () => {
    it('flags CONFLICT when client expectedVersion does not match current server version', async () => {
      await syncService.registerDevice({
        deviceId: 'dev-03',
        deviceName: 'Device 03',
        appVersion: '2.0.0',
      });

      // Set server entity to version 3
      mockBeneficiaries.set('ben-20', {
        beneficiary_id: 'ben-20',
        name: 'Server Current',
        version: 3,
      });

      // Client submits update expecting version 1
      const staleEnvelope = {
        clientOpId: 'op-uuid-1020',
        operationType: 'UPDATE_BENEFICIARY',
        entityType: 'Beneficiary',
        entityId: 'ben-20',
        expectedVersion: 1,
        payloadJson: { name: 'Client Stale Update' },
      };

      const res = await syncService.processPush({
        deviceId: 'dev-03',
        operations: [staleEnvelope],
      });

      expect(res.conflictCount).toBe(1);
      expect(res.results[0].status).toBe('CONFLICT');
      expect(res.results[0].code).toBe('VERSION_MISMATCH');
      expect(res.results[0].conflict.actualVersion).toBe(3);
    });
  });

  describe('SYNC-033: Concurrent Payment Overpayment Arbitration', () => {
    it('accepts payment up to pending balance and auto-routes excess to BeneficiaryAdvanceLedger', async () => {
      await syncService.registerDevice({
        deviceId: 'dev-04',
        deviceName: 'Device 04',
        appVersion: '2.0.0',
      });

      // Bill with only ₹3,000 pending
      mockRunningBills.set('rb-33', {
        running_bill_id: 'rb-33',
        beneficiary_id: 'ben-33',
        amount_due: new Decimal(10000),
        amount_paid: new Decimal(7000),
        pending_amount: new Decimal(3000),
        status: 'PARTIALLY_PAID',
        version: 1,
      });

      // Field agent records offline cash payment of ₹5,000
      const paymentEnvelope = {
        clientOpId: 'op-uuid-1033',
        operationType: 'RECORD_PAYMENT',
        entityType: 'Payment',
        entityId: 'pay-33',
        payloadJson: {
          runningBillId: 'rb-33',
          beneficiaryId: 'ben-33',
          amount: 5000,
          paymentMode: 'CASH',
          receiptNumber: 'OFFLINE-REC-33',
        },
      };

      const res = await syncService.processPush({
        deviceId: 'dev-04',
        operations: [paymentEnvelope],
      });

      expect(res.appliedCount).toBe(1);
      expect(res.results[0].status).toBe('APPLIED');
      expect(res.results[0].data.overpaymentRoutedToAdvance).toBe(true);

      // Verify bill updated to exact 0 pending
      const updatedBill = mockRunningBills.get('rb-33');
      expect(new Decimal(updatedBill.amount_paid).toFixed(2)).toBe('10000.00');
      expect(new Decimal(updatedBill.pending_amount).toFixed(2)).toBe('0.00');
      expect(updatedBill.status).toBe('PAID');

      // Verify excess ₹2,000 routed to BeneficiaryAdvanceLedger
      expect(mockAdvances.size).toBe(1);
      const adv = Array.from(mockAdvances.values())[0];
      expect(adv.beneficiary_id).toBe('ben-33');
      expect(new Decimal(adv.amount).toFixed(2)).toBe('2000.00');
      expect(adv.reference_type).toBe('OVERPAYMENT_ARBITRATION');
    });
  });

  describe('SYNC-040: Incremental Delta Pull Cursor Pagination', () => {
    it('returns committed changes since given feed ID and tracks pagination', async () => {
      // Seed 3 events in server change feed
      mockFeed.push(
        { feed_id: 1, entity_type: 'Beneficiary', entity_id: 'b1', operation_type: 'CREATE', payload_json: '{}' },
        { feed_id: 2, entity_type: 'WaterAllotment', entity_id: 'a1', operation_type: 'APPROVE', payload_json: '{}' },
        { feed_id: 3, entity_type: 'RunningBill', entity_id: 'rb1', operation_type: 'GENERATE', payload_json: '{}' },
      );

      // Pull from sequence 0 with limit 2
      const pull1 = await syncService.processPull(0, 2);
      expect(pull1.changes.length).toBe(2);
      expect(pull1.changes[0].feedId).toBe(1);
      expect(pull1.changes[1].feedId).toBe(2);
      expect(pull1.latestFeedId).toBe(2);
      expect(pull1.hasMore).toBe(true);

      // Subsequent pull from cursor 2
      const pull2 = await syncService.processPull(2, 2);
      expect(pull2.changes.length).toBe(1);
      expect(pull2.changes[0].feedId).toBe(3);
      expect(pull2.latestFeedId).toBe(3);
      expect(pull2.hasMore).toBe(false);
    });
  });

  describe('SYNC-050: Client Acknowledgment Flow', () => {
    it('updates device last_ack_feed_id on acknowledge call', async () => {
      await syncService.registerDevice({
        deviceId: 'dev-05',
        deviceName: 'Device 05',
        appVersion: '2.0.0',
      });

      const ack = await syncService.processAck({
        deviceId: 'dev-05',
        acknowledgedFeedId: 42,
      });

      expect(ack.deviceId).toBe('dev-05');
      expect(ack.acknowledgedFeedId).toBe(42);

      const device = mockDevices.get('dev-05');
      expect(device.last_ack_feed_id).toBe(42);
    });
  });
});
