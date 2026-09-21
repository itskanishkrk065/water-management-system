import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RecordPaymentDto, ReversePaymentDto } from './dto/payment.dto';
import { AuditAction, BillStatus, InstallmentStatus, PaymentStatus, Prisma } from '@prisma/client';
import { DecimalUtil } from '../common/decimal.util';
import { Decimal } from 'decimal.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Records a payment immutably against an installment, running bill, or extension.
   * Updates amounts paid, pending amounts, and statuses in a single database transaction.
   */
  async recordPayment(
    dto: RecordPaymentDto,
    recordedBy: string,
    userId?: string,
    ipAddress?: string,
  ) {
    if (!dto.installmentId && !dto.runningBillId && !dto.extensionId) {
      throw new BadRequestException('Payment must be associated with an installment, running bill, or extension.');
    }

    const payAmount = DecimalUtil.roundMoney(new Decimal(dto.amount));
    const receiptNumber = this.generateReceiptNumber();
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Payment for Installment
      if (dto.installmentId) {
        const installment = await tx.installment.findUnique({
          where: { installment_id: dto.installmentId },
          include: { bill: true },
        });
        if (!installment) {
          throw new NotFoundException(`Installment ${dto.installmentId} not found`);
        }
        if (installment.status === InstallmentStatus.PAID) {
          throw new BadRequestException('Installment is already fully paid.');
        }

        const currentPaid = new Decimal(installment.amount_paid);
        const amountDue = new Decimal(installment.amount_due);
        const pendingAmount = new Decimal(installment.pending_amount);

        if (payAmount.greaterThan(pendingAmount)) {
          throw new BadRequestException(
            `Payment amount ₹${payAmount.toFixed(2)} exceeds pending installment amount ₹${pendingAmount.toFixed(2)}.`,
          );
        }

        const newPaid = DecimalUtil.roundMoney(DecimalUtil.add(currentPaid, payAmount));
        const newPending = DecimalUtil.roundMoney(DecimalUtil.sub(amountDue, newPaid));
        const newStatus = newPending.isZero()
          ? InstallmentStatus.PAID
          : InstallmentStatus.PARTIALLY_PAID;

        // Create Payment record
        const payment = await tx.payment.create({
          data: {
            beneficiary_id: dto.beneficiaryId,
            installment_id: dto.installmentId,
            amount: payAmount,
            payment_date: paymentDate,
            payment_reference: dto.paymentReference || null,
            receipt_number: receiptNumber,
            payment_mode: dto.paymentMode,
            status: PaymentStatus.COMPLETED,
            remarks: dto.remarks || null,
            recorded_by: recordedBy,
          },
        });

        // Update Installment
        await tx.installment.update({
          where: { installment_id: dto.installmentId },
          data: {
            amount_paid: newPaid,
            pending_amount: newPending,
            status: newStatus,
          },
        });

        // Update Parent Development Bill
        const bill = await tx.developmentBill.findUnique({
          where: { bill_id: installment.bill_id },
        });
        if (bill) {
          const billPaid = DecimalUtil.roundMoney(DecimalUtil.add(new Decimal(bill.amount_paid), payAmount));
          const billPending = DecimalUtil.roundMoney(DecimalUtil.sub(new Decimal(bill.total_amount), billPaid));
          const billStatus = billPending.isZero() ? BillStatus.PAID : BillStatus.PARTIALLY_PAID;

          await tx.developmentBill.update({
            where: { bill_id: bill.bill_id },
            data: {
              amount_paid: billPaid,
              pending_amount: billPending,
              status: billStatus,
            },
          });
        }

        return payment;
      }

      // 2. Payment for Running Bill
      if (dto.runningBillId) {
        const runningBill = await tx.runningBill.findUnique({
          where: { running_bill_id: dto.runningBillId },
        });
        if (!runningBill) {
          throw new NotFoundException(`Running bill ${dto.runningBillId} not found`);
        }
        if (runningBill.status === BillStatus.PAID) {
          throw new BadRequestException('Running bill is already fully paid.');
        }

        const currentPaid = new Decimal(runningBill.amount_paid);
        const amountDue = new Decimal(runningBill.amount_due);
        const pendingAmount = new Decimal(runningBill.pending_amount);

        if (payAmount.greaterThan(pendingAmount)) {
          throw new BadRequestException(
            `Payment amount ₹${payAmount.toFixed(2)} exceeds pending running bill amount ₹${pendingAmount.toFixed(2)}.`,
          );
        }

        const newPaid = DecimalUtil.roundMoney(DecimalUtil.add(currentPaid, payAmount));
        const newPending = DecimalUtil.roundMoney(DecimalUtil.sub(amountDue, newPaid));
        const newStatus = newPending.isZero() ? BillStatus.PAID : BillStatus.PARTIALLY_PAID;

        const payment = await tx.payment.create({
          data: {
            beneficiary_id: dto.beneficiaryId,
            running_bill_id: dto.runningBillId,
            amount: payAmount,
            payment_date: paymentDate,
            payment_reference: dto.paymentReference || null,
            receipt_number: receiptNumber,
            payment_mode: dto.paymentMode,
            status: PaymentStatus.COMPLETED,
            remarks: dto.remarks || null,
            recorded_by: recordedBy,
          },
        });

        await tx.runningBill.update({
          where: { running_bill_id: dto.runningBillId },
          data: {
            amount_paid: newPaid,
            pending_amount: newPending,
            status: newStatus,
          },
        });

        return payment;
      }

      // 3. Payment for Extension
      const payment = await tx.payment.create({
        data: {
          beneficiary_id: dto.beneficiaryId,
          extension_id: dto.extensionId,
          amount: payAmount,
          payment_date: paymentDate,
          payment_reference: dto.paymentReference || null,
          receipt_number: receiptNumber,
          payment_mode: dto.paymentMode,
          status: PaymentStatus.COMPLETED,
          remarks: dto.remarks || null,
          recorded_by: recordedBy,
        },
      });

      return payment;
    });

    await this.auditService.log({
      userId,
      action: AuditAction.PAYMENT_RECORDED,
      entityType: 'Payment',
      entityId: result.payment_id,
      newValues: result,
      reason: `Recorded payment of ₹${dto.amount} with receipt ${receiptNumber}`,
      ipAddress,
    });

    return result;
  }

  /**
   * Reverses a payment and updates the associated balances in a single transaction.
   */
  async reversePayment(
    paymentId: string,
    dto: ReversePaymentDto,
    reversedBy: string,
    userId?: string,
    ipAddress?: string,
  ) {
    const original = await this.prisma.payment.findUnique({
      where: { payment_id: paymentId },
    });
    if (!original) {
      throw new NotFoundException('Payment record not found');
    }
    if (original.status === PaymentStatus.REVERSED || original.is_reversal) {
      throw new BadRequestException('Payment is already reversed or is a reversal entry.');
    }

    const reversalReceipt = this.generateReceiptNumber('REV');
    const revAmount = new Decimal(original.amount);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Mark original payment as REVERSED
      await tx.payment.update({
        where: { payment_id: paymentId },
        data: { status: PaymentStatus.REVERSED },
      });

      // 2. Insert Reversal Payment transaction
      const reversalRecord = await tx.payment.create({
        data: {
          beneficiary_id: original.beneficiary_id,
          installment_id: original.installment_id,
          running_bill_id: original.running_bill_id,
          extension_id: original.extension_id,
          amount: revAmount.negated(),
          payment_date: new Date(),
          payment_reference: `Reversal of ${original.receipt_number}`,
          receipt_number: reversalReceipt,
          payment_mode: original.payment_mode,
          status: PaymentStatus.COMPLETED,
          is_reversal: true,
          reversal_payment_id: original.payment_id,
          remarks: dto.reason,
          recorded_by: reversedBy,
        },
      });

      // 3. Rollback Installment & Development Bill if applicable
      if (original.installment_id) {
        const inst = await tx.installment.findUnique({
          where: { installment_id: original.installment_id },
        });
        if (inst) {
          const newPaid = DecimalUtil.roundMoney(DecimalUtil.sub(new Decimal(inst.amount_paid), revAmount));
          const newPending = DecimalUtil.roundMoney(DecimalUtil.add(new Decimal(inst.pending_amount), revAmount));
          const newStatus = newPaid.isZero() ? InstallmentStatus.PENDING : InstallmentStatus.PARTIALLY_PAID;

          await tx.installment.update({
            where: { installment_id: inst.installment_id },
            data: {
              amount_paid: newPaid,
              pending_amount: newPending,
              status: newStatus,
            },
          });

          const bill = await tx.developmentBill.findUnique({
            where: { bill_id: inst.bill_id },
          });
          if (bill) {
            const billPaid = DecimalUtil.roundMoney(DecimalUtil.sub(new Decimal(bill.amount_paid), revAmount));
            const billPending = DecimalUtil.roundMoney(DecimalUtil.add(new Decimal(bill.pending_amount), revAmount));
            const billStatus = billPaid.isZero() ? BillStatus.PENDING : BillStatus.PARTIALLY_PAID;

            await tx.developmentBill.update({
              where: { bill_id: bill.bill_id },
              data: {
                amount_paid: billPaid,
                pending_amount: billPending,
                status: billStatus,
              },
            });
          }
        }
      }

      // 4. Rollback Running Bill if applicable
      if (original.running_bill_id) {
        const rBill = await tx.runningBill.findUnique({
          where: { running_bill_id: original.running_bill_id },
        });
        if (rBill) {
          const newPaid = DecimalUtil.roundMoney(DecimalUtil.sub(new Decimal(rBill.amount_paid), revAmount));
          const newPending = DecimalUtil.roundMoney(DecimalUtil.add(new Decimal(rBill.pending_amount), revAmount));
          const newStatus = newPaid.isZero() ? BillStatus.PENDING : BillStatus.PARTIALLY_PAID;

          await tx.runningBill.update({
            where: { running_bill_id: rBill.running_bill_id },
            data: {
              amount_paid: newPaid,
              pending_amount: newPending,
              status: newStatus,
            },
          });
        }
      }

      return reversalRecord;
    });

    await this.auditService.log({
      userId,
      action: AuditAction.PAYMENT_REVERSED,
      entityType: 'Payment',
      entityId: paymentId,
      oldValues: original,
      newValues: result,
      reason: dto.reason,
      ipAddress,
    });

    return result;
  }

  async findAll(query: {
    beneficiaryId?: string;
    installmentId?: string;
    receiptNumber?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {};
    if (query.beneficiaryId) where.beneficiary_id = query.beneficiaryId;
    if (query.installmentId) where.installment_id = query.installmentId;
    if (query.receiptNumber) where.receipt_number = { contains: query.receiptNumber };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { payment_date: 'desc' },
        skip,
        take: limit,
        include: {
          beneficiary: { select: { beneficiary_id: true, name: true, phone_number: true } },
          installment: {
            include: {
              bill: { select: { bill_id: true, allotment_id: true } },
            },
          },
          runningBill: true,
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { payment_id: id },
      include: {
        beneficiary: {
          include: { district: true, panchayat: true, village: true },
        },
        installment: {
          include: { bill: true },
        },
        runningBill: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    return payment;
  }

  private generateReceiptNumber(prefix = 'REC'): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.floor(Math.random() * 0xfffff)
      .toString(16)
      .toUpperCase()
      .padStart(5, '0');
    return `${prefix}-${dateStr}-${randomHex}`;
  }
}
