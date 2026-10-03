import { Test, TestingModule } from '@nestjs/testing';
import { ClientSyncWorkerService } from './client-sync-worker.service';
import { SyncService } from './sync.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WaterGrid V2 — Client Sync Worker & Local Outbox Engine (WORKER-001 to WORKER-006)', () => {
  let worker: ClientSyncWorkerService;
  let syncService: SyncService;

  const mockOutbox = new Map<string, any>();

  const mockPrisma: any = {
    syncOutbox: {
      create: jest.fn(async ({ data }) => {
        const item = { ...data, outbox_id: `outbox-${mockOutbox.size + 1}`, created_at: new Date() };
        mockOutbox.set(item.client_op_id, item);
        return item;
      }),
      findMany: jest.fn(async ({ where, take }) => {
        const allowedStatuses = where?.status?.in || [where?.status];
        const items = Array.from(mockOutbox.values()).filter((item) =>
          allowedStatuses.includes(item.status),
        );
        return items.slice(0, take || 50);
      }),
      update: jest.fn(async ({ where, data }) => {
        const key = where.client_op_id || Array.from(mockOutbox.values()).find((i) => i.outbox_id === where.outbox_id)?.client_op_id;
        const existing = mockOutbox.get(key);
        if (!existing) return null;
        const updated = { ...existing, ...data };
        mockOutbox.set(key, updated);
        return updated;
      }),
      count: jest.fn(async ({ where }) => {
        const allowedStatuses = where?.status?.in || [where?.status];
        return Array.from(mockOutbox.values()).filter((item) =>
          allowedStatuses.includes(item.status),
        ).length;
      }),
    },
  };

  const mockSyncService = {
    processPush: jest.fn(),
    processPull: jest.fn(),
    processAck: jest.fn(),
  };

  beforeEach(async () => {
    mockOutbox.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientSyncWorkerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SyncService, useValue: mockSyncService },
      ],
    }).compile();

    worker = module.get<ClientSyncWorkerService>(ClientSyncWorkerService);
    syncService = module.get<SyncService>(SyncService);
    worker.setDeviceId('TEST-TABLET-01');

    jest.clearAllMocks();
  });

  describe('WORKER-001: Atomic Enqueue to SyncOutbox', () => {
    it('creates an outbox item with PENDING status and valid metadata', async () => {
      const item = await worker.enqueueOperation({
        operationType: 'RECORD_USAGE',
        entityType: 'WaterUsageRecord',
        entityId: 'usage-100',
        payloadJson: { actualUsageLitres: 42000, billingPeriodId: 'bp-2026-09' },
        schemaVersion: 1,
      });

      expect(item.client_op_id).toBeDefined();
      expect(item.status).toBe('PENDING');
      expect(item.device_id).toBe('TEST-TABLET-01');
      expect(item.operation_type).toBe('RECORD_USAGE');
      expect(mockOutbox.size).toBe(1);
    });
  });

  describe('WORKER-002: Batch Drain & ACK Processing', () => {
    it('drains pending outbox items and marks them ACKNOWLEDGED on successful server push', async () => {
      // 1. Enqueue 2 operations
      const op1 = await worker.enqueueOperation({
        operationType: 'RECORD_PAYMENT',
        entityType: 'Payment',
        entityId: 'pay-1',
        payloadJson: { amount: 5000 },
      });
      const op2 = await worker.enqueueOperation({
        operationType: 'UPDATE_BENEFICIARY',
        entityType: 'Beneficiary',
        entityId: 'ben-1',
        payloadJson: { name: 'Updated Farmer' },
      });

      // 2. Mock successful server response
      mockSyncService.processPush.mockResolvedValueOnce({
        appliedCount: 2,
        alreadyAcceptedCount: 0,
        conflictCount: 0,
        rejectedCount: 0,
        results: [
          { clientOpId: op1.client_op_id, status: 'APPLIED', code: 'SUCCESS' },
          { clientOpId: op2.client_op_id, status: 'APPLIED', code: 'SUCCESS' },
        ],
      });

      // 3. Drain outbox
      const drainResult = await worker.drainOutbox(10);

      expect(drainResult.processedCount).toBe(2);
      expect(drainResult.appliedCount).toBe(2);
      expect(worker.getState()).toBe('ONLINE');

      // Verify outbox statuses updated to ACKNOWLEDGED
      const item1 = mockOutbox.get(op1.client_op_id);
      const item2 = mockOutbox.get(op2.client_op_id);
      expect(item1.status).toBe('ACKNOWLEDGED');
      expect(item1.synced_at).toBeDefined();
      expect(item2.status).toBe('ACKNOWLEDGED');
    });
  });

  describe('WORKER-003: Exponential Backoff Calculation', () => {
    it('calculates backoff within valid exponential boundaries with jitter', () => {
      const b0 = worker.computeBackoffMs(0); // 1s base
      expect(b0).toBeGreaterThanOrEqual(500);
      expect(b0).toBeLessThanOrEqual(1000);

      const b3 = worker.computeBackoffMs(3); // 2^3 = 8s
      expect(b3).toBeGreaterThanOrEqual(4000);
      expect(b3).toBeLessThanOrEqual(8000);

      const b10 = worker.computeBackoffMs(10); // capped at 60s
      expect(b10).toBeGreaterThanOrEqual(30000);
      expect(b10).toBeLessThanOrEqual(60000);
    });
  });

  describe('WORKER-004: Transient Network Failure & Offline State Transition', () => {
    it('transitions state to OFFLINE and increments retry_count when server cannot be reached', async () => {
      const op = await worker.enqueueOperation({
        operationType: 'RECORD_PAYMENT',
        entityType: 'Payment',
        entityId: 'pay-fail-1',
        payloadJson: { amount: 1000 },
      });

      mockSyncService.processPush.mockRejectedValueOnce(new Error('Network error: connect ECONNREFUSED 127.0.0.1:4000'));

      const drainResult = await worker.drainOutbox(10);

      expect(drainResult.failedCount).toBe(1);
      expect(worker.getState()).toBe('OFFLINE');

      const item = mockOutbox.get(op.client_op_id);
      expect(item.status).toBe('RETRYING');
      expect(item.retry_count).toBe(1);
      expect(item.last_error).toContain('ECONNREFUSED');
    });
  });

  describe('WORKER-005: Conflict Detection & Attention Required State', () => {
    it('marks item CONFLICT and transitions state to ATTENTION_REQUIRED when server reports conflict', async () => {
      const op = await worker.enqueueOperation({
        operationType: 'UPDATE_BENEFICIARY',
        entityType: 'Beneficiary',
        entityId: 'ben-conflict-1',
        payloadJson: { name: 'Conflicting Name' },
      });

      mockSyncService.processPush.mockResolvedValueOnce({
        appliedCount: 0,
        alreadyAcceptedCount: 0,
        conflictCount: 1,
        rejectedCount: 0,
        results: [
          {
            clientOpId: op.client_op_id,
            status: 'CONFLICT',
            code: 'VERSION_MISMATCH',
            message: 'Server entity has advanced past client expected version.',
          },
        ],
      });

      const drainResult = await worker.drainOutbox(10);

      expect(drainResult.conflictCount).toBe(1);
      expect(worker.getState()).toBe('ATTENTION_REQUIRED');

      const item = mockOutbox.get(op.client_op_id);
      expect(item.status).toBe('CONFLICT');
      expect(item.last_error).toContain('advanced past');
    });
  });

  describe('WORKER-006: Incremental Delta Pull & Feed Acknowledgment', () => {
    it('pulls server changes and sends acknowledgment for the latest feed id', async () => {
      mockSyncService.processPull.mockResolvedValueOnce({
        changes: [
          { feedId: 10, entityType: 'Payment', entityId: 'p10' },
          { feedId: 11, entityType: 'RunningBill', entityId: 'rb11' },
        ],
        latestFeedId: 11,
        hasMore: false,
      });

      mockSyncService.processAck.mockResolvedValueOnce({
        deviceId: 'TEST-TABLET-01',
        acknowledgedFeedId: 11,
      });

      const result = await worker.pullDeltas(9);

      expect(result.appliedDeltasCount).toBe(2);
      expect(result.latestFeedId).toBe(11);
      expect(mockSyncService.processAck).toHaveBeenCalledWith({
        deviceId: 'TEST-TABLET-01',
        acknowledgedFeedId: 11,
      });
    });
  });
});
