import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { SyncConflictService } from './sync-conflict.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApplicationClockService } from '../system/application-clock.service';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

describe('WaterGrid V2 — Phase 7: Conflict Resolution & UI Diagnostics (SYNC7-001 to SYNC7-004)', () => {
  let syncService: SyncService;

  const mockOutbox = new Map<string, any>();
  const mockBeneficiaries = new Map<string, any>();
  const mockAdvances = new Map<string, any>();

  const mockPrisma: any = {
    syncOutbox: {
      findMany: jest.fn(async ({ where }) => {
        let items = Array.from(mockOutbox.values());
        if (where?.status) {
          items = items.filter((i) => i.status === where.status);
        }
        return items;
      }),
      findUnique: jest.fn(async ({ where }) => {
        return mockOutbox.get(where.client_op_id) || null;
      }),
      update: jest.fn(async ({ where, data }) => {
        const item = mockOutbox.get(where.client_op_id);
        if (!item) throw new NotFoundException();
        const updated = { ...item, ...data };
        mockOutbox.set(where.client_op_id, updated);
        return updated;
      }),
    },
    beneficiary: {
      findUnique: jest.fn(async ({ where }) => {
        return mockBeneficiaries.get(where.beneficiary_id) || null;
      }),
    },
    beneficiaryAdvanceLedger: {
      findMany: jest.fn(async () => {
        return Array.from(mockAdvances.values());
      }),
    },
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    mockOutbox.clear();
    mockBeneficiaries.clear();
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
    jest.clearAllMocks();
  });

  describe('SYNC7-001: Outbox Queue Inspection', () => {
    it('retrieves and deserializes envelopes from sync outbox with status filtering', async () => {
      mockOutbox.set('op-1', {
        outbox_id: 'box-1',
        client_op_id: 'op-1',
        status: 'PENDING',
        payload_json: JSON.stringify({ amount: 1500 }),
        created_at: new Date(),
      });
      mockOutbox.set('op-2', {
        outbox_id: 'box-2',
        client_op_id: 'op-2',
        status: 'ACKNOWLEDGED',
        payload_json: JSON.stringify({ amount: 3000 }),
        created_at: new Date(),
      });

      const pending = await syncService.getOutboxItems('PENDING');
      expect(pending.length).toBe(1);
      expect(pending[0].client_op_id).toBe('op-1');
      expect(pending[0].payload.amount).toBe(1500);

      const all = await syncService.getOutboxItems('ALL');
      expect(all.length).toBe(2);
    });
  });

  describe('SYNC7-002: Conflict Workspace Data Enrichment', () => {
    it('pairs client conflicting payload with authoritative server database record for visual diffing', async () => {
      // Server record has version 5
      mockBeneficiaries.set('ben-10', {
        beneficiary_id: 'ben-10',
        name: 'Kongu Farmer Server Authoritative',
        version: 5,
      });

      // Outbox item conflict expecting version 3
      mockOutbox.set('op-conf-10', {
        outbox_id: 'box-conf-10',
        client_op_id: 'op-conf-10',
        entity_type: 'Beneficiary',
        entity_id: 'ben-10',
        operation_type: 'UPDATE_BENEFICIARY',
        status: 'CONFLICT',
        payload_json: JSON.stringify({ name: 'Kongu Farmer Stale Attempt' }),
        schema_version: 1,
        retry_count: 2,
        last_error: 'Version mismatch: expected 3, server has 5',
        created_at: new Date(),
      });

      const conflicts = await syncService.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].clientPayload.name).toBe('Kongu Farmer Stale Attempt');
      expect(conflicts[0].serverRecord.name).toBe('Kongu Farmer Server Authoritative');
      expect(conflicts[0].serverRecord.version).toBe(5);
    });
  });

  describe('SYNC7-003: Conflict Resolution Strategies', () => {
    beforeEach(() => {
      mockOutbox.set('op-resolve-1', {
        outbox_id: 'box-res-1',
        client_op_id: 'op-resolve-1',
        status: 'CONFLICT',
        payload_json: JSON.stringify({ name: 'Old Stale' }),
        last_error: 'Conflict detected',
      });
    });

    it('resolves conflict with ACCEPT_SERVER strategy', async () => {
      const res = await syncService.resolveConflict(
        'op-resolve-1',
        { strategy: 'ACCEPT_SERVER' },
        'admin-user',
      );

      expect(res.status).toBe('RESOLVED');
      expect(res.last_error).toContain('Accepted server');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-user',
          entityType: 'SyncOutbox',
        }),
      );
    });

    it('resolves conflict with FORCE_CLIENT strategy', async () => {
      const res = await syncService.resolveConflict(
        'op-resolve-1',
        { strategy: 'FORCE_CLIENT' },
        'admin-user',
      );

      expect(res.status).toBe('PENDING');
      expect(res.retry_count).toBe(0);
      expect(res.last_error).toContain('Force client');
    });

    it('resolves conflict with MERGE strategy', async () => {
      const res = await syncService.resolveConflict(
        'op-resolve-1',
        { strategy: 'MERGE', mergedPayload: { name: 'Merged Name', phone: '9999999999' } },
        'admin-user',
      );

      expect(res.status).toBe('PENDING');
      expect(res.payload_json).toContain('Merged Name');
      expect(res.last_error).toContain('Merged payload');
    });
  });

  describe('SYNC7-004: Advance Credit Ledger Queries', () => {
    it('returns advance credit records generated via overpayment arbitration', async () => {
      mockAdvances.set('adv-1', {
        advance_id: 'adv-1',
        beneficiary_id: 'ben-01',
        amount: new Decimal(2000),
        balance_amount: new Decimal(2000),
        reference_type: 'OVERPAYMENT_ARBITRATION',
        created_at: new Date(),
      });

      const list = await syncService.getAdvanceLedger();
      expect(list.length).toBe(1);
      expect(list[0].advance_id).toBe('adv-1');
      expect(list[0].reference_type).toBe('OVERPAYMENT_ARBITRATION');
    });
  });
});
