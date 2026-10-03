import { Test, TestingModule } from '@nestjs/testing';
import { ClientSyncWorkerService, ENTITY_DEPENDENCY_ORDER } from './client-sync-worker.service';
import { SyncService } from './sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { AuthService } from '../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { ApplicationClockService } from '../system/application-clock.service';
import * as bcrypt from 'bcryptjs';

describe('WaterGrid V2 — Phase 6: Bi-Directional Push/Pull Sync, Dependency Graph & SafeStorage (SYNC6-001 to SYNC6-004)', () => {
  let worker: ClientSyncWorkerService;
  let syncService: SyncService;
  let paymentsService: PaymentsService;
  let authService: AuthService;

  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({ token_id: 'rt-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    beneficiary: {
      findUnique: jest.fn().mockResolvedValue({ beneficiary_id: 'ben-01' }),
      upsert: jest.fn().mockResolvedValue({ beneficiary_id: 'ben-01' }),
    },
    payment: {
      findUnique: jest.fn(),
      upsert: jest.fn().mockResolvedValue({ payment_id: 'pay-01' }),
    },
    syncOutbox: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    runningBill: {
      findUnique: jest.fn(),
    },
    installment: {
      findUnique: jest.fn(),
    },
  };

  const mockSyncService = {
    processPull: jest.fn(),
    processAck: jest.fn().mockResolvedValue({}),
    processPush: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientSyncWorkerService,
        PaymentsService,
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SyncService, useValue: mockSyncService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: ApplicationClockService, useValue: null },
      ],
    }).compile();

    worker = module.get<ClientSyncWorkerService>(ClientSyncWorkerService);
    syncService = module.get<SyncService>(SyncService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    authService = module.get<AuthService>(AuthService);

    worker.setDeviceId('DESKTOP-CLIENT-TIRUPPUR');
    jest.clearAllMocks();
  });

  describe('SYNC6-001: Echo Suppression (Loopback Prevention)', () => {
    it('skips applying deltas that originated from the local device and suppresses duplicate re-insertion', async () => {
      mockSyncService.processPull.mockResolvedValueOnce({
        changes: [
          // Foreign change from another officer's tablet
          {
            feedId: 101,
            entityType: 'Beneficiary',
            entityId: 'ben-ext-1',
            operationType: 'CREATE',
            originDeviceId: 'TABLET-COIMBATORE-01',
            payload: { beneficiary_id: 'ben-ext-1', name: 'External Farmer' },
          },
          // Local echo that this desktop pushed earlier
          {
            feedId: 102,
            entityType: 'Payment',
            entityId: 'pay-local-1',
            operationType: 'RECORD_PAYMENT',
            originDeviceId: 'DESKTOP-CLIENT-TIRUPPUR', // MATCHES LOCAL DEVICE!
            payload: { payment_id: 'pay-local-1', amount: 5000 },
          },
        ],
        latestFeedId: 102,
        hasMore: false,
      });

      const result = await worker.pullDeltas(100);

      expect(result.appliedDeltasCount).toBe(1); // Only foreign change applied
      expect(result.skippedEchoCount).toBe(1); // Echo change skipped
      expect(result.latestFeedId).toBe(102);

      // Verify server ACK was sent to advance cursor past echo
      expect(mockSyncService.processAck).toHaveBeenCalledWith({
        deviceId: 'DESKTOP-CLIENT-TIRUPPUR',
        acknowledgedFeedId: 102,
      });

      // Verify beneficiary was upserted, but payment was not re-upserted
      expect(mockPrisma.beneficiary.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.payment.upsert).toHaveBeenCalledTimes(0);
    });
  });

  describe('SYNC6-002: Topological Dependency Ingestion Ordering', () => {
    it('sorts foreign deltas in foreign-key dependency order before applying them locally', async () => {
      const callOrder: string[] = [];

      mockPrisma.beneficiary.upsert.mockImplementationOnce(async () => {
        callOrder.push('Beneficiary');
        return {};
      });
      mockPrisma.payment.upsert.mockImplementationOnce(async () => {
        callOrder.push('Payment');
        return {};
      });

      // Arrives OUT OF ORDER: Child (Payment) before Parent (Beneficiary)
      mockSyncService.processPull.mockResolvedValueOnce({
        changes: [
          {
            feedId: 201,
            entityType: 'Payment',
            entityId: 'pay-01',
            originDeviceId: 'REMOTE-SERVER',
            payload: { payment_id: 'pay-01', amount: 3000 },
          },
          {
            feedId: 202,
            entityType: 'Beneficiary',
            entityId: 'ben-01',
            originDeviceId: 'REMOTE-SERVER',
            payload: { beneficiary_id: 'ben-01', name: 'Parent Beneficiary' },
          },
        ],
        latestFeedId: 202,
        hasMore: false,
      });

      const result = await worker.pullDeltas(200);

      expect(result.appliedDeltasCount).toBe(2);
      expect(ENTITY_DEPENDENCY_ORDER['beneficiary']).toBeLessThan(ENTITY_DEPENDENCY_ORDER['payment']);
      // Beneficiary MUST be processed before Payment
      expect(callOrder).toEqual(['Beneficiary', 'Payment']);
    });
  });

  describe('SYNC6-003: Offline Receipt Watermark Generation', () => {
    it('renders OFFLINE RECEIPT watermark when payment is awaiting server ACK in outbox', async () => {
      const mockPayment = {
        payment_id: 'pay-offline-1',
        receipt_number: 'REC-OFFLINE-99',
        amount: 2500,
        payment_date: new Date(),
        payment_mode: 'CASH',
        status: 'COMPLETED',
        beneficiary_id: 'ben-01',
        beneficiary: { name: 'Muthusamy', phone_number: '9842100099' },
      };

      jest.spyOn(paymentsService, 'findOne').mockResolvedValueOnce(mockPayment as any);

      // Payment is still in outbox with PENDING status
      mockPrisma.syncOutbox.findFirst.mockResolvedValueOnce({
        outbox_id: 'outbox-1',
        status: 'PENDING',
      });

      const receipt = await paymentsService.generatePaymentReceiptPdf('pay-offline-1');
      expect(receipt.buffer).toBeDefined();
      expect(receipt.fileName).toBe('Payment_Receipt_REC-OFFLINE-99.pdf');

      // PDFKit uncompressed streams contain glyph ASCII hex within TJ operators
      const pdfText = receipt.buffer.toString('utf8');
      const offlineHex = Buffer.from('OFFLINE RECEIPT').toString('hex');
      expect(pdfText).toContain(offlineHex);
    });

    it('renders SERVER CONFIRMED status when payment is acknowledged by server', async () => {
      const mockPayment = {
        payment_id: 'pay-confirmed-1',
        receipt_number: 'REC-CONFIRMED-88',
        amount: 4000,
        payment_date: new Date(),
        payment_mode: 'UPI',
        status: 'COMPLETED',
        beneficiary_id: 'ben-01',
        beneficiary: { name: 'Muthusamy', phone_number: '9842100099' },
      };

      jest.spyOn(paymentsService, 'findOne').mockResolvedValueOnce(mockPayment as any);

      // Outbox item is ACKNOWLEDGED
      mockPrisma.syncOutbox.findFirst.mockResolvedValueOnce({
        outbox_id: 'outbox-2',
        status: 'ACKNOWLEDGED',
      });

      const receipt = await paymentsService.generatePaymentReceiptPdf('pay-confirmed-1');
      const pdfText = receipt.buffer.toString('utf8');
      const confirmedHex = Buffer.from('CONFIRMED').toString('hex');
      const offlineHex = Buffer.from('OFFLINE RECEIPT').toString('hex');
      expect(pdfText).toContain(confirmedHex);
      expect(pdfText).not.toContain(offlineHex);
    });
  });

  describe('SYNC6-004: Device-Bound Token Generation', () => {
    it('binds deviceId to JWT token payload during login', async () => {
      const passwordHash = await bcrypt.hash('secret123', 10);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        user_id: 'user-01',
        email: 'officer@water.gov',
        password_hash: passwordHash,
        full_name: 'Field Officer A',
        is_active: true,
        role: { name: 'FIELD_OFFICER' },
      });

      const result = await authService.login(
        { email: 'officer@water.gov', password: 'secret123' },
        'DEV-MAC-COIMBATORE-TABLET-01',
      );

      expect(result.accessToken).toBeDefined();
      expect(result.user.deviceId).toBe('DEV-MAC-COIMBATORE-TABLET-01');

      const jwt = new JwtService();
      const decoded: any = jwt.decode(result.accessToken);
      expect(decoded.deviceId).toBe('DEV-MAC-COIMBATORE-TABLET-01');
      expect(decoded.sub).toBe('user-01');
    });
  });
});
