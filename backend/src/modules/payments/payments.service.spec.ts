import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException } from '@nestjs/common';
import { PaymentMode, PaymentStatus, InstallmentStatus } from '../common/enums';

describe('PaymentsService Workflow and Financial Invariant Suite', () => {
  let service: PaymentsService;

  const mockPrismaService = {
    installment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    developmentBill: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    runningBill: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    extension: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({}),
    recordAudit: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  describe('CASH and UPI Payment Recording', () => {
    it('should record cash payment without requiring gateway/UTR references', async () => {
      mockPrismaService.installment.findUnique.mockResolvedValue({
        installment_id: 'inst-1',
        bill_id: 'bill-1',
        amount_due: 5000,
        amount_paid: 0,
        pending_amount: 5000,
        status: InstallmentStatus.PENDING,
        bill: {
          bill_id: 'bill-1',
          amount_paid: 0,
          pending_amount: 50000,
          total_amount: 50000,
          beneficiary_id: 'ben-1',
        },
      });

      mockPrismaService.developmentBill.findUnique.mockResolvedValue({
        bill_id: 'bill-1',
        amount_paid: 0,
        pending_amount: 50000,
        total_amount: 50000,
      });

      mockPrismaService.payment.create.mockResolvedValue({
        payment_id: 'pay-1',
        receipt_number: 'REC-2026-0001',
        amount: 5000,
        payment_mode: PaymentMode.CASH,
        status: PaymentStatus.COMPLETED,
      });

      const result = await service.recordPayment(
        {
          installmentId: 'inst-1',
          beneficiaryId: 'ben-1',
          amount: 5000,
          paymentMode: PaymentMode.CASH,
          collector_name: 'Cashier Agent',
          remarks: 'Standard cash collection',
        } as any,
        'user-1',
      );

      expect(result).toBeDefined();
      expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payment_mode: PaymentMode.CASH,
            status: PaymentStatus.COMPLETED,
          }),
        }),
      );
    });

    it('should reject payment amounts that exceed the pending installment balance', async () => {
      mockPrismaService.installment.findUnique.mockResolvedValue({
        installment_id: 'inst-1',
        amount_due: 5000,
        amount_paid: 2000,
        pending_amount: 3000,
        status: InstallmentStatus.PARTIALLY_PAID,
        bill: {
          bill_id: 'bill-1',
          amount_paid: 2000,
          pending_amount: 48000,
          total_amount: 50000,
        },
      });

      await expect(
        service.recordPayment(
          {
            installmentId: 'inst-1',
            beneficiaryId: 'ben-1',
            amount: 4000, // Exceeds pending_amount of 3000
            paymentMode: PaymentMode.CASH,
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
