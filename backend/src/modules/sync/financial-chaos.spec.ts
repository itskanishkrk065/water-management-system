import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { SyncConflictService } from './sync-conflict.service';
import { ClientSyncWorkerService, ENTITY_DEPENDENCY_ORDER } from './client-sync-worker.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApplicationClockService } from '../system/application-clock.service';
import { Decimal } from 'decimal.js';

describe('WaterGrid V2 — Phase 8: Distributed Financial Chaos Simulation (CHAOS-001 to CHAOS-004)', () => {
  let syncService: SyncService;
  let conflictService: SyncConflictService;
  let worker: ClientSyncWorkerService;

  // In-memory data structures
  const syncOperations = new Map<string, any>();
  const changeFeed: any[] = [];
  const registeredDevices = new Map<string, any>();
  const advanceLedgers: any[] = [];
  const payments: any[] = [];

  const mockRunningBill: any = {
    running_bill_id: 'rb-chaos-100',
    beneficiary_id: 'ben-chaos-1',
    amount_due: new Decimal(10000),
    amount_paid: new Decimal(0),
    pending_amount: new Decimal(10000),
    status: 'PENDING',
    version: 1,
  };

  const mockPrisma: any = {
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    deviceRegistration: {
      findUnique: jest.fn(async ({ where }) => registeredDevices.get(where.device_id) || null),
      update: jest.fn(async ({ where, data }) => {
        const d = registeredDevices.get(where.device_id);
        if (d) Object.assign(d, data);
        return d;
      }),
    },
    syncOperation: {
      findUnique: jest.fn(async ({ where }) => syncOperations.get(where.client_op_id) || null),
      create: jest.fn(async ({ data }) => {
        syncOperations.set(data.client_op_id, data);
        return data;
      }),
    },
    serverChangeFeed: {
      create: jest.fn(async ({ data }) => {
        const entry = { ...data, feed_id: changeFeed.length + 1 };
        changeFeed.push(entry);
        return entry;
      }),
      findMany: jest.fn(async ({ where, take }) => {
        const since = where?.feed_id?.gt || 0;
        return changeFeed.filter((c) => c.feed_id > since).slice(0, take || 100);
      }),
    },
    runningBill: {
      findUnique: jest.fn(async ({ where }) => {
        if (where.running_bill_id === mockRunningBill.running_bill_id) return mockRunningBill;
        return null;
      }),
      update: jest.fn(async ({ where, data }) => {
        if (where.running_bill_id === mockRunningBill.running_bill_id) {
          Object.assign(mockRunningBill, data);
          return mockRunningBill;
        }
        return null;
      }),
    },
    payment: {
      create: jest.fn(async ({ data }) => {
        const p = { ...data, payment_id: `pay-chaos-${payments.length + 1}` };
        payments.push(p);
        return p;
      }),
    },
    beneficiaryAdvanceLedger: {
      create: jest.fn(async ({ data }) => {
        const adv = { ...data, advance_id: `adv-chaos-${advanceLedgers.length + 1}` };
        advanceLedgers.push(adv);
        return adv;
      }),
    },
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    syncOperations.clear();
    changeFeed.length = 0;
    registeredDevices.clear();
    advanceLedgers.length = 0;
    payments.length = 0;

    mockRunningBill.amount_due = new Decimal(10000);
    mockRunningBill.amount_paid = new Decimal(0);
    mockRunningBill.pending_amount = new Decimal(10000);
    mockRunningBill.status = 'PENDING';
    mockRunningBill.version = 1;

    // Register 2 test field devices
    registeredDevices.set('DEVICE-A-OFFLINE', {
      device_id: 'DEVICE-A-OFFLINE',
      is_active: true,
      status: 'ACTIVE',
      last_ack_feed_id: 0,
    });
    registeredDevices.set('DEVICE-B-OFFLINE', {
      device_id: 'DEVICE-B-OFFLINE',
      is_active: true,
      status: 'ACTIVE',
      last_ack_feed_id: 0,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        SyncConflictService,
        ClientSyncWorkerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: ApplicationClockService, useValue: null },
      ],
    }).compile();

    syncService = module.get<SyncService>(SyncService);
    conflictService = module.get<SyncConflictService>(SyncConflictService);
    worker = module.get<ClientSyncWorkerService>(ClientSyncWorkerService);

    jest.clearAllMocks();
  });

  describe('CHAOS-001: Concurrent Payment Flood & Double Spend Prevention', () => {
    it('arbitrates concurrent payments on same bill, caps bill at amount due, and auto-routes excess to advance ledger', async () => {
      // Device A collected ₹6,000 cash offline
      const pushA = await syncService.processPush({
        deviceId: 'DEVICE-A-OFFLINE',
        operations: [
          {
            clientOpId: 'op-flood-01',
            operationType: 'RECORD_PAYMENT',
            entityType: 'Payment',
            entityId: 'pay-flood-1',
            payloadJson: {
              runningBillId: 'rb-chaos-100',
              beneficiaryId: 'ben-chaos-1',
              amount: 6000,
              paymentMode: 'CASH',
            },
          },
        ],
      });

      expect(pushA.appliedCount).toBe(1);
      expect(mockRunningBill.amount_paid.toNumber()).toBe(6000);
      expect(mockRunningBill.pending_amount.toNumber()).toBe(4000);
      expect(mockRunningBill.status).toBe('PARTIALLY_PAID');
      expect(advanceLedgers.length).toBe(0);

      // Device B also collected ₹6,000 cash offline on the same bill (total ₹12,000 > ₹10,000)
      const pushB = await syncService.processPush({
        deviceId: 'DEVICE-B-OFFLINE',
        operations: [
          {
            clientOpId: 'op-flood-02',
            operationType: 'RECORD_PAYMENT',
            entityType: 'Payment',
            entityId: 'pay-flood-2',
            payloadJson: {
              runningBillId: 'rb-chaos-100',
              beneficiaryId: 'ben-chaos-1',
              amount: 6000,
              paymentMode: 'CASH',
            },
          },
        ],
      });

      expect(pushB.appliedCount).toBe(1);
      // Running bill is capped at ₹10,000 (PAID)
      expect(mockRunningBill.amount_paid.toNumber()).toBe(10000);
      expect(mockRunningBill.pending_amount.toNumber()).toBe(0);
      expect(mockRunningBill.status).toBe('PAID');

      // Remaining ₹2,000 automatically routed to BeneficiaryAdvanceLedger
      expect(advanceLedgers.length).toBe(1);
      expect(advanceLedgers[0].beneficiary_id).toBe('ben-chaos-1');
      expect(Number(advanceLedgers[0].amount)).toBe(2000);
      expect(Number(advanceLedgers[0].balance_amount)).toBe(2000);
      expect(advanceLedgers[0].reference_type).toBe('OVERPAYMENT_ARBITRATION');

      // Total money preserved across bill payments (₹6,000 + ₹4,000) + advance credit (₹2,000) = ₹12,000
      const totalBillPayments = payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const totalAdvanceCredits = advanceLedgers.reduce((acc, a) => acc + Number(a.amount), 0);
      expect(totalBillPayments).toBe(10000);
      expect(totalAdvanceCredits).toBe(2000);
      expect(totalBillPayments + totalAdvanceCredits).toBe(12000);
    });
  });

  describe('CHAOS-002: Lost Network ACK After Server Commit', () => {
    it('idempotently returns ALREADY_ACCEPTED on client retry without duplicate financial writes', async () => {
      const envelope = {
        clientOpId: 'op-lost-ack-999',
        operationType: 'RECORD_PAYMENT',
        entityType: 'Payment',
        entityId: 'pay-ack-99',
        payloadJson: {
          runningBillId: 'rb-chaos-100',
          beneficiaryId: 'ben-chaos-1',
          amount: 5000,
        },
      };

      // 1. Initial push succeeds on server
      const firstPush = await syncService.processPush({
        deviceId: 'DEVICE-A-OFFLINE',
        operations: [envelope],
      });
      expect(firstPush.appliedCount).toBe(1);
      expect(payments.length).toBe(1);

      // 2. Client network drops before receiving 200 OK. Client reconnects and retries identical batch
      const retryPush = await syncService.processPush({
        deviceId: 'DEVICE-A-OFFLINE',
        operations: [envelope],
      });

      expect(retryPush.alreadyAcceptedCount).toBe(1);
      expect(retryPush.appliedCount).toBe(0);
      expect(retryPush.results[0].status).toBe('ALREADY_ACCEPTED');

      // Verify no duplicate payment was created
      expect(payments.length).toBe(1);
    });
  });

  describe('CHAOS-003: Topological Stream Ingestion Stability', () => {
    it('correctly orders entities based on dependency graph hierarchy regardless of arrival order', () => {
      const entityTypes = [
        'Payment',
        'RunningBill',
        'WaterUsageRecord',
        'WaterAllotment',
        'WaterApplication',
        'LandHolding',
        'Beneficiary',
        'Village',
        'District',
      ];

      // Sort according to ENTITY_DEPENDENCY_ORDER
      const sorted = [...entityTypes].sort((a, b) => {
        return (ENTITY_DEPENDENCY_ORDER[a.toLowerCase()] || 999) - (ENTITY_DEPENDENCY_ORDER[b.toLowerCase()] || 999);
      });

      // Verify strict topological ordering
      expect(sorted[0]).toBe('District');
      expect(sorted[1]).toBe('Village');
      expect(sorted[2]).toBe('Beneficiary');
      expect(sorted[3]).toBe('LandHolding');
      expect(sorted[4]).toBe('WaterApplication');
      expect(sorted[5]).toBe('WaterAllotment');
      expect(sorted[6]).toBe('WaterUsageRecord');
      expect(sorted[7]).toBe('RunningBill');
      expect(sorted[8]).toBe('Payment');
    });
  });

  describe('CHAOS-004: Zero-Float Monetary Precision Invariant', () => {
    it('verifies exact monetary balance without floating-point rounding errors across 3-way split', () => {
      const split1 = new Decimal('3333.33');
      const split2 = new Decimal('3333.33');
      const split3 = new Decimal('3333.34');

      const sum = split1.plus(split2).plus(split3);
      expect(sum.toString()).toBe('10000');
      expect(sum.toNumber()).toBe(10000.00);

      // Verify float would have introduced inaccuracies:
      const floatSum = 3333.33 + 3333.33 + 3333.34;
      // In JS float: 3333.33 + 3333.33 + 3333.34 is 10000, but differences occur with subtractions
      const rem = new Decimal(10000).minus(split1).minus(split2).minus(split3);
      expect(rem.isZero()).toBe(true);
    });
  });
});
