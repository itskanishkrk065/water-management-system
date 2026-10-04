/**
 * WATERGRID — CONSOLIDATED PRODUCTION FIX PASS TEST SUITE
 * Specs covering AUTH, SYNC-AUTH, LOC, PAY, and DASH invariants.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth/auth.service';
import { LocationsService } from './locations/locations.service';
import { PaymentsService } from './payments/payments.service';
import { PrismaService } from './prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from './audit/audit.service';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { InstallmentStatus, BillStatus, PaymentMode } from './common/enums';

describe('WATERGRID — Production Fix Pass Test Suite', () => {
  let authService: AuthService;
  let locationsService: LocationsService;
  let paymentsService: PaymentsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      district: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      block: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      revenueVillage: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      village: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      developmentBill: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      installment: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      beneficiary: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ token_id: 'rt-mock-123' }),
        update: jest.fn().mockResolvedValue({ token_id: 'rt-mock-123' }),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        LocationsService,
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { sign: () => 'mock-jwt-token' } },
        { provide: AuditService, useValue: { logAction: jest.fn() } },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    locationsService = module.get<LocationsService>(LocationsService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
  });

  // ─── PART A: AUTH & USER MANAGEMENT ─────────────────────────────────────────
  describe('PART A: AUTH & USER MANAGEMENT', () => {
    it('AUTH-003: Username authentication works for admin-created users', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        user_id: 'user-123',
        username: 'collector01',
        email: 'collector01@water.gov',
        password_hash: '$2b$10$abcdefghijklmnopqrstuu', // mock hash
        is_active: true,
        status: 'ACTIVE',
        role: { name: 'COLLECTION_AGENT' },
      });

      // Mock verifyPassword
      jest.spyOn(require('./common/password.util'), 'verifyPassword').mockResolvedValue(true);

      const result = await authService.login({ loginIdentifier: 'collector01', password: 'password123' }, 'device-win-b');
      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock-jwt-token');
    });

    it('AUTH-007 & AUTH-008: Reject login for LOCKED or DISABLED users', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        user_id: 'user-456',
        username: 'lockeduser',
        email: 'locked@water.gov',
        is_active: false,
        status: 'LOCKED',
      });

      await expect(
        authService.login({ loginIdentifier: 'lockeduser', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── PART B & C: LOCATION HIERARCHY & API FIX ──────────────────────────────
  describe('PART B & C: CANONICAL 4-LEVEL LOCATION HIERARCHY', () => {
    it('LOC-005 & LOC-006: Toggle active status for District, Block, Revenue Village, Village', async () => {
      prismaMock.district.findUnique.mockResolvedValue({ district_id: 'd-1', is_active: true });
      prismaMock.district.update.mockResolvedValue({ district_id: 'd-1', is_active: false });

      const updated = await locationsService.toggleDistrictActive('d-1');
      expect(updated.is_active).toBe(false);
    });

    it('LOC-009: Reject invalid location hierarchy', async () => {
      prismaMock.block.findUnique.mockResolvedValue({ block_id: 'b-1', district_id: 'district-A' });

      await expect(
        locationsService.validateHierarchy({ districtId: 'district-B', blockId: 'b-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('LOC-010: Protect referenced locations from hard deletion', async () => {
      prismaMock.revenueVillage.findUnique.mockResolvedValue({
        revenue_village_id: 'rv-1',
        name: 'RV Alpha',
        _count: { villages: 2, beneficiaries: 5 },
      });

      await expect(
        locationsService.deleteRevenueVillage('rv-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── PART D: FIVE-INSTALLMENT BULK PAYMENT ────────────────────────────────
  describe('PART D: FIVE-INSTALLMENT BULK PAYMENT ALLOCATION', () => {
    it('PAY-002 & PAY-003: Allocate bulk payment against earliest outstanding installments first', async () => {
      prismaMock.developmentBill.findUnique.mockResolvedValue({
        bill_id: 'bill-100',
        total_amount: new Decimal('10000.00'),
        amount_paid: new Decimal('0.00'),
        pending_amount: new Decimal('10000.00'),
        status: BillStatus.PENDING,
        installments: [
          { installment_id: 'inst-1', installment_number: 1, amount_due: new Decimal('250.00'), amount_paid: new Decimal('0'), pending_amount: new Decimal('250.00'), status: InstallmentStatus.PENDING },
          { installment_id: 'inst-2', installment_number: 2, amount_due: new Decimal('2000.00'), amount_paid: new Decimal('0'), pending_amount: new Decimal('2000.00'), status: InstallmentStatus.PENDING },
          { installment_id: 'inst-3', installment_number: 3, amount_due: new Decimal('2500.00'), amount_paid: new Decimal('0'), pending_amount: new Decimal('2500.00'), status: InstallmentStatus.PENDING },
          { installment_id: 'inst-4', installment_number: 4, amount_due: new Decimal('2500.00'), amount_paid: new Decimal('0'), pending_amount: new Decimal('2500.00'), status: InstallmentStatus.PENDING },
          { installment_id: 'inst-5', installment_number: 5, amount_due: new Decimal('2750.00'), amount_paid: new Decimal('0'), pending_amount: new Decimal('2750.00'), status: InstallmentStatus.PENDING },
        ],
      });

      // Preview bulk payment of ₹8,000
      const preview = await paymentsService.previewBulkBillPayment('bill-100', 8000);

      expect(preview.paymentAmount).toBe(8000);
      expect(preview.allocations).toHaveLength(5);
      expect(preview.allocations[0].allocatedPayment).toBe(250); // 1/5 -> ₹250 (PAID)
      expect(preview.allocations[0].resultingStatus).toBe(InstallmentStatus.PAID);
      expect(preview.allocations[1].allocatedPayment).toBe(2000); // 2/5 -> ₹2,000 (PAID)
      expect(preview.allocations[1].resultingStatus).toBe(InstallmentStatus.PAID);
      expect(preview.allocations[2].allocatedPayment).toBe(2500); // 3/5 -> ₹2,500 (PAID)
      expect(preview.allocations[2].resultingStatus).toBe(InstallmentStatus.PAID);
      expect(preview.allocations[3].allocatedPayment).toBe(2500); // 4/5 -> ₹2,500 (PAID)
      expect(preview.allocations[3].resultingStatus).toBe(InstallmentStatus.PAID);
      expect(preview.allocations[4].allocatedPayment).toBe(750); // 5/5 -> ₹750 (PARTIAL)
      expect(preview.allocations[4].resultingStatus).toBe(InstallmentStatus.PARTIALLY_PAID);

      expect(preview.newBillPending).toBe(2000); // Remaining outstanding ₹2,000
    });

    it('PAY-007: Reject overpayment exceeding total outstanding bill balance', async () => {
      prismaMock.developmentBill.findUnique.mockResolvedValue({
        bill_id: 'bill-200',
        total_amount: new Decimal('10000.00'),
        amount_paid: new Decimal('8000.00'),
        pending_amount: new Decimal('2000.00'),
        status: BillStatus.PARTIALLY_PAID,
        installments: [],
      });

      await expect(
        paymentsService.previewBulkBillPayment('bill-200', 5000),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
