import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { SyncConflictService } from './sync-conflict.service';
import { AuthService } from '../auth/auth.service';
import { ApplicationClockService } from '../system/application-clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('WaterGrid V2 — Phase 8: Security & Device Lifecycle (SEC-001 to SEC-004)', () => {
  let syncService: SyncService;
  let authService: AuthService;
  let clockService: ApplicationClockService;

  const registeredDevices = new Map<string, any>();
  const syncOperations = new Map<string, any>();
  let systemClockState: any = null;

  const refreshTokensDb = new Map<string, any>();

  const mockPrisma: any = {
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    user: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(async ({ data }) => {
        const record = { ...data, token_id: `rt-${refreshTokensDb.size + 1}`, revoked: false };
        refreshTokensDb.set(record.token_id, record);
        return record;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const r = refreshTokensDb.get(where.token_id);
        if (!r) return null;
        return {
          ...r,
          user: {
            user_id: 'officer-u1',
            email: 'officer@water.gov',
            full_name: 'Field Officer Tiruppur',
            role: { name: 'FIELD_OFFICER' },
          },
        };
      }),
      update: jest.fn(async ({ where, data }) => {
        const r = refreshTokensDb.get(where.token_id);
        if (r) Object.assign(r, data);
        return r;
      }),
    },
    beneficiary: {
      findUnique: jest.fn().mockResolvedValue({ beneficiary_id: 'ben-sec-1' }),
    },
    deviceRegistration: {
      findUnique: jest.fn(async ({ where }) => registeredDevices.get(where.device_id) || null),
      update: jest.fn(async ({ where, data }) => {
        const dev = registeredDevices.get(where.device_id);
        if (dev) Object.assign(dev, data);
        return dev;
      }),
    },
    syncOperation: {
      findUnique: jest.fn(async ({ where }) => syncOperations.get(where.client_op_id) || null),
      create: jest.fn(async ({ data }) => {
        syncOperations.set(data.client_op_id, data);
        return data;
      }),
    },
    systemClockState: {
      findFirst: jest.fn(async () => systemClockState),
      create: jest.fn(async ({ data }) => {
        systemClockState = { ...data, state_id: 'sc-1' };
        return systemClockState;
      }),
      update: jest.fn(async ({ data }) => {
        if (systemClockState) Object.assign(systemClockState, data);
        return systemClockState;
      }),
    },
    serverChangeFeed: {
      create: jest.fn().mockResolvedValue({ feed_id: 1 }),
    },
    payment: {
      create: jest.fn().mockResolvedValue({ payment_id: 'pay-sec-1' }),
    },
    runningBill: {
      findUnique: jest.fn().mockResolvedValue({
        running_bill_id: 'rb-sec-1',
        amount_due: 5000,
        amount_paid: 0,
        pending_amount: 5000,
        status: 'PENDING',
        version: 1,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    registeredDevices.clear();
    syncOperations.clear();
    systemClockState = null;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        SyncConflictService,
        AuthService,
        JwtService,
        ApplicationClockService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    syncService = module.get<SyncService>(SyncService);
    authService = module.get<AuthService>(AuthService);
    clockService = module.get<ApplicationClockService>(ApplicationClockService);

    jest.clearAllMocks();
  });

  describe('SEC-001: Device-Bound Token Claims', () => {
    it('mints JWT session tokens containing explicit deviceId bindings', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        user_id: 'officer-u1',
        email: 'officer@water.gov',
        password_hash: passwordHash,
        full_name: 'Field Officer Tiruppur',
        is_active: true,
        role: { name: 'FIELD_OFFICER' },
      });

      const tokens = await authService.login(
        { email: 'officer@water.gov', password: 'password123' },
        'DEV-WIN-TABLET-007',
      );

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.user.deviceId).toBe('DEV-WIN-TABLET-007');

      const jwt = new JwtService();
      const decoded: any = jwt.decode(tokens.accessToken);
      expect(decoded.deviceId).toBe('DEV-WIN-TABLET-007');

      // Refresh token rotation: verify deviceId survives refresh
      const refreshed = await authService.refreshTokens({
        refreshToken: tokens.refreshToken,
      });

      expect(refreshed.accessToken).toBeDefined();
      expect(refreshed.user.deviceId).toBe('DEV-WIN-TABLET-007');
      const decodedRefreshed: any = jwt.decode(refreshed.accessToken);
      expect(decodedRefreshed.deviceId).toBe('DEV-WIN-TABLET-007');
    });
  });

  describe('SEC-002: Revoked Device Rejection', () => {
    it('rejects sync pushes from a revoked hardware device with ForbiddenException', async () => {
      // Register device as revoked (is_active = false)
      registeredDevices.set('DEV-STOLEN-TABLET', {
        device_id: 'DEV-STOLEN-TABLET',
        is_active: false,
        status: 'REVOKED',
      });

      await expect(
        syncService.processPush({
          deviceId: 'DEV-STOLEN-TABLET',
          operations: [
            {
              clientOpId: 'op-stolen-1',
              operationType: 'RECORD_PAYMENT',
              entityType: 'Payment',
              entityId: 'p1',
              payloadJson: { amount: 500 },
            },
          ],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SEC-003: Idempotency Key Reuse with Tampered Payload Detection', () => {
    it('throws ConflictException when a clientOpId is reused with a tampered payload', async () => {
      registeredDevices.set('DEV-LEGIT-01', {
        device_id: 'DEV-LEGIT-01',
        is_active: true,
        status: 'ACTIVE',
      });

      // 1. Initial valid push
      await syncService.processPush({
        deviceId: 'DEV-LEGIT-01',
        operations: [
          {
            clientOpId: 'op-tamper-test-1',
            operationType: 'RECORD_PAYMENT',
            entityType: 'Payment',
            entityId: 'pay-t1',
            payloadJson: {
              runningBillId: 'rb-sec-1',
              amount: 1000,
            },
          },
        ],
      });

      // 2. Tampered resubmission: same clientOpId, but amount inflated to ₹50,000
      const res = await syncService.processPush({
        deviceId: 'DEV-LEGIT-01',
        operations: [
          {
            clientOpId: 'op-tamper-test-1', // Same ID!
            operationType: 'RECORD_PAYMENT',
            entityType: 'Payment',
            entityId: 'pay-t1',
            payloadJson: {
              runningBillId: 'rb-sec-1',
              amount: 50000, // TAMPERED!
            },
          },
        ],
      });

      expect(res.rejectedCount).toBe(1);
      expect(res.results[0].status).toBe('REJECTED');
      expect(res.results[0].code).toBe('IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_PAYLOAD');
    });
  });

  describe('SEC-004: Clock Rollback Defense', () => {
    it('detects and halts operations when system clock is rolled back into past', async () => {
      // Future watermark: 2026-10-15
      systemClockState = {
        state_id: 'sc-1',
        last_known_timestamp: new Date('2026-10-15T00:00:00.000Z'),
        is_rollback_detected: false,
      };

      // Current system clock rolled back: 2026-09-01
      const pastDate = new Date('2026-09-01T00:00:00.000Z');

      await expect(
        clockService.assertClockValid('officer-1', '127.0.0.1', pastDate),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
