import { Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RecordPaymentDto, ReversePaymentDto } from './dto/payment.dto';
import { AuditAction, AuditEntityType, BillStatus, InstallmentStatus, PaymentStatus, PaymentMode } from '../common/enums';
import { Prisma } from '@prisma/client';
import { DecimalUtil } from '../common/decimal.util';
import { Decimal } from 'decimal.js';
import { ApplicationClockService } from '../system/application-clock.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() private readonly clock?: ApplicationClockService,
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
    if (this.clock) {
      await this.clock.assertClockValid(userId, ipAddress);
    }

    if (!dto.installmentId && !dto.runningBillId && !dto.extensionId) {
      throw new BadRequestException('Payment must be associated with an installment, running bill, or extension.');
    }

    if (dto.amount === undefined || dto.amount === null || isNaN(Number(dto.amount))) {
      throw new BadRequestException('A valid numerical payment amount is required.');
    }

    const payAmount = DecimalUtil.roundMoney(new Decimal(dto.amount));
    if (payAmount.lte(0)) {
      throw new BadRequestException('Payment amount must be strictly greater than zero.');
    }

    const receiptNumber = this.generateReceiptNumber();
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const mode = dto.paymentMode || dto.paymentMethod || PaymentMode.CASH;
    const ref = mode === PaymentMode.CASH ? null : (dto.paymentReference || dto.referenceNumber || null);
    const remarks = dto.remarks || dto.notes || null;
    const officer = dto.collectorName || dto.collector || recordedBy;

    // Idempotency check (RUN-NEW-041)
    if (dto.idempotencyKey) {
      const existingPayment = await this.prisma.payment.findFirst({
        where: {
          payment_reference: dto.idempotencyKey,
          status: { not: PaymentStatus.REVERSED },
        },
      });
      if (existingPayment) {
        return existingPayment;
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let createdPayment: any = null;

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

        const beneficiaryId = dto.beneficiaryId || installment.bill?.beneficiary_id;
        if (!beneficiaryId) {
          throw new BadRequestException('Unable to resolve beneficiary for this installment payment.');
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
        createdPayment = await tx.payment.create({
          data: {
            beneficiary_id: beneficiaryId,
            installment_id: dto.installmentId,
            amount: payAmount,
            payment_date: paymentDate,
            payment_reference: ref,
            receipt_number: receiptNumber,
            payment_mode: mode,
            status: PaymentStatus.COMPLETED,
            remarks,
            recorded_by: officer,
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
      } else if (dto.runningBillId) {
        // 2. Payment for Running Bill
        const runningBill = await tx.runningBill.findUnique({
          where: { running_bill_id: dto.runningBillId },
        });
        if (!runningBill) {
          throw new NotFoundException(`Running bill ${dto.runningBillId} not found`);
        }
        if (runningBill.status === BillStatus.PAID) {
          throw new BadRequestException('Running bill is already fully paid.');
        }
        if (runningBill.status === BillStatus.CANCELLED) {
          throw new BadRequestException('Cannot record payment against a cancelled running bill.');
        }

        const beneficiaryId = dto.beneficiaryId || runningBill.beneficiary_id;
        if (dto.beneficiaryId && dto.beneficiaryId !== runningBill.beneficiary_id) {
          throw new BadRequestException('Beneficiary ID mismatch with running bill beneficiary.');
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

        createdPayment = await tx.payment.create({
          data: {
            beneficiary_id: beneficiaryId,
            running_bill_id: dto.runningBillId,
            amount: payAmount,
            payment_date: paymentDate,
            payment_reference: ref,
            receipt_number: receiptNumber,
            payment_mode: mode,
            status: PaymentStatus.COMPLETED,
            remarks,
            recorded_by: officer,
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
      } else if (dto.extensionId) {
        // 3. Payment for Extension
        createdPayment = await tx.payment.create({
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
      }

      if (createdPayment) {
        // Atomic audit log inside transaction
        await this.auditService.log({
          userId,
          action: AuditAction.PAYMENT_RECORDED,
          entityType: AuditEntityType.PAYMENT,
          entityId: createdPayment.payment_id,
          newValues: createdPayment,
          reason: `Recorded payment of ₹${dto.amount} with receipt ${receiptNumber}`,
          ipAddress,
          tx,
        });
      }

      return createdPayment;
    });

    return result;
  }

  /**
   * Dedicated running bill payment recorder — called from the beneficiary portal.
   *
   * Differences from the generic recordPayment path:
   * 1. Enforces ownership: validates that the running bill belongs to this beneficiary.
   * 2. Validates infrastructure commissioning to prevent payment on ineligible bills.
   * 3. Emits RUNNING_BILL_PAYMENT_RECORDED audit action (not generic PAYMENT_RECORDED).
   * 4. Prevents routing to installment or extension paths — only running bill logic runs.
   * 5. Rejects voided / cancelled bills before any writes.
   */
  async recordRunningBillPayment(
    runningBillId: string,
    dto: {
      amount: number;
      paymentMode?: string;
      paymentReference?: string;
      paymentDate?: string;
      remarks?: string;
      idempotencyKey?: string;
    },
    beneficiaryId: string,
    recordedBy: string,
    userId?: string,
    ipAddress?: string,
  ) {
    if (this.clock) {
      await this.clock.assertClockValid(userId, ipAddress);
    }

    if (!runningBillId) {
      throw new BadRequestException('Running bill ID is required.');
    }
    if (dto.amount === undefined || dto.amount === null || isNaN(Number(dto.amount))) {
      throw new BadRequestException('A valid numerical payment amount is required.');
    }

    const payAmount = DecimalUtil.roundMoney(new Decimal(dto.amount));
    if (payAmount.lte(0)) {
      throw new BadRequestException('Payment amount must be strictly greater than zero.');
    }

    const receiptNumber = this.generateReceiptNumber('RRC');
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const mode = (dto.paymentMode || 'CASH') as any;
    const ref = mode === 'CASH' ? null : (dto.paymentReference || null);
    const idempKey = dto.idempotencyKey || (ref ? ref : undefined);

    // Idempotency check (RUN-NEW-041)
    if (idempKey) {
      const existing = await this.prisma.payment.findFirst({
        where: {
          running_bill_id: runningBillId,
          payment_reference: idempKey,
          status: { not: PaymentStatus.REVERSED },
        },
      });
      if (existing) {
        return existing;
      }
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      // 1. Authoritative running bill load INSIDE transaction
      const runningBill = await tx.runningBill.findUnique({
        where: { running_bill_id: runningBillId },
        include: {
          allotment: {
            include: { infrastructure: { select: { status: true } } },
          },
        },
      });

      if (!runningBill) {
        throw new NotFoundException(`Running bill ${runningBillId} not found.`);
      }

      // Ownership gate: if beneficiaryId is explicitly provided (self-service portal), verify ownership
      const effectiveBeneficiaryId = runningBill.beneficiary_id;
      if (beneficiaryId && beneficiaryId !== effectiveBeneficiaryId) {
        throw new BadRequestException('Running bill does not belong to your account.');
      }

      // Status guards
      if (runningBill.status === BillStatus.PAID) {
        throw new BadRequestException('Running bill is already fully paid.');
      }
      if (runningBill.status === BillStatus.CANCELLED) {
        throw new BadRequestException('Cannot record payment against a cancelled running bill.');
      }

      // Infrastructure commissioning guard
      const infraStatus = runningBill.allotment?.infrastructure?.status;
      if (infraStatus && infraStatus !== 'COMMISSIONED') {
        throw new BadRequestException(
          `Infrastructure is not COMMISSIONED (current: ${infraStatus}). Running charges cannot be collected until commissioning.`,
        );
      }

      const pendingAmount = new Decimal(runningBill.pending_amount);
      if (payAmount.greaterThan(pendingAmount)) {
        throw new BadRequestException(
          `Payment amount ₹${payAmount.toFixed(2)} exceeds pending running bill amount ₹${pendingAmount.toFixed(2)}.`,
        );
      }

      const newPaid = DecimalUtil.roundMoney(
        DecimalUtil.add(new Decimal(runningBill.amount_paid), payAmount),
      );
      const newPending = DecimalUtil.roundMoney(
        DecimalUtil.sub(new Decimal(runningBill.amount_due), newPaid),
      );
      const newStatus = newPending.isZero() ? BillStatus.PAID : BillStatus.PARTIALLY_PAID;

      // Immutable payment record — linked exclusively to running_bill_id
      const created = await tx.payment.create({
        data: {
          beneficiary_id: effectiveBeneficiaryId,
          running_bill_id: runningBillId,
          amount: payAmount,
          payment_date: paymentDate,
          payment_reference: idempKey || ref,
          receipt_number: receiptNumber,
          payment_mode: mode,
          status: PaymentStatus.COMPLETED,
          remarks: dto.remarks || null,
          recorded_by: recordedBy,
        },
      });

      // Update running bill balances atomically
      await tx.runningBill.update({
        where: { running_bill_id: runningBillId },
        data: {
          amount_paid: newPaid,
          pending_amount: newPending,
          status: newStatus,
        },
      });

      // Specific audit action distinguishes running bill payments from installment payments
      await this.auditService.log({
        userId,
        action: AuditAction.RUNNING_PAYMENT_RECORDED,
        entityType: AuditEntityType.PAYMENT,
        entityId: created.payment_id,
        newValues: {
          runningBillId,
          amount: payAmount.toFixed(2),
          receiptNumber,
          beneficiaryId: effectiveBeneficiaryId,
          paymentMode: mode,
          billingPeriod: runningBill.billing_period,
        },
        reason: `Running bill payment of ₹${payAmount.toFixed(2)} recorded. Receipt: ${receiptNumber}. Period: ${runningBill.billing_period}.`,
        ipAddress,
        tx,
      });

      return created;
    });

    return payment;
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

      // Atomic audit logging inside transaction
      await this.auditService.log({
        userId,
        action: AuditAction.PAYMENT_REVERSED,
        entityType: AuditEntityType.PAYMENT,
        entityId: paymentId,
        oldValues: original,
        newValues: reversalRecord,
        reason: dto.reason,
        ipAddress,
        tx,
      });

      return reversalRecord;
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
          include: { district: true, block: true, panchayat: true, village: true },
        },
        installment: {
          include: {
            bill: {
              include: {
                allotment: {
                  include: {
                    application: {
                      include: { landHolding: { include: { parcels: true } } },
                    },
                    rate: true,
                  },
                },
              },
            },
          },
        },
        runningBill: {
          include: {
            allotment: {
              include: {
                application: { include: { project: true } },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    return payment;
  }

  async generatePaymentReceiptPdf(id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const payment = await this.findOne(id);
    const PDFDocument = require('pdfkit');

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      compress: false,
      info: {
        Title: `Payment Receipt ${payment.receipt_number}`,
        Author: 'Kongu Basin Water Management Authority',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    const isReversed = payment.status === 'REVERSED' || payment.is_reversal;

    // Watermark & Sync Verification Status Check
    let isPendingSync = false;
    try {
      const outboxItem = await (this.prisma as any).syncOutbox?.findFirst({
        where: {
          entity_id: payment.payment_id,
          entity_type: 'Payment',
        },
      });
      isPendingSync = !!outboxItem && outboxItem.status !== 'ACKNOWLEDGED';
    } catch {}

    const confirmationText = isPendingSync ? 'OFFLINE (AWAITING SERVER CONFIRMATION)' : 'SERVER CONFIRMED';

    // Header Banner
    doc.rect(40, 40, 515, 65).fill(isReversed ? '#7f1d1d' : '#0f172a');
    doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold').text('KONGU BASIN WATER MANAGEMENT AUTHORITY', 55, 52);
    doc.fontSize(10).font('Helvetica').fillColor('#94a3b8').text(isReversed ? 'OFFICIAL PAYMENT REVERSAL MEMORANDUM' : 'OFFICIAL GOVERNMENT PAYMENT RECEIPT', 55, 72);
    doc.fillColor(isReversed ? '#fca5a5' : '#38bdf8').fontSize(9).font('Helvetica-Bold').text(`Receipt #: ${payment.receipt_number}`, 360, 52, { align: 'right', width: 180 });
    doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica').text(`Date: ${new Date(payment.payment_date).toLocaleDateString('en-IN')}`, 360, 68, { align: 'right', width: 180 });

    doc.moveDown(3);

    // Diagonal Watermark for unconfirmed offline payments
    if (isPendingSync) {
      doc.save();
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#b45309', 0.20);
      doc.rotate(-28, { origin: [297, 421] });
      doc.text('OFFLINE RECEIPT — AWAITING SERVER CONFIRMATION', 40, 410, { align: 'center', width: 515 });
      doc.restore();
    }

    // Status Ribbon
    doc.rect(40, 115, 515, 24).fill(isReversed ? '#fee2e2' : isPendingSync ? '#fef3c7' : '#ecfdf5');
    doc.fillColor(isReversed ? '#991b1b' : isPendingSync ? '#92400e' : '#065f46').fontSize(9).font('Helvetica-Bold').text(
      `STATUS: ${payment.status} ${payment.is_reversal ? '(REVERSAL ENTRY)' : ''} | ${confirmationText} | MODE: ${payment.payment_mode}`,
      55,
      122,
    );

    // Section 1: Beneficiary & Location Details
    doc.rect(40, 148, 515, 95).fill('#f8fafc');
    doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold').text('1. BENEFICIARY & LOCATION PARTICULARS', 55, 158);

    doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
    doc.text(`Beneficiary Name: ${payment.beneficiary?.name || 'N/A'}`, 55, 178);
    doc.text(`Phone Number: ${payment.beneficiary?.phone_number || 'N/A'}`, 55, 194);
    doc.text(`Beneficiary ID: ${payment.beneficiary_id}`, 55, 210);

    const b = payment.beneficiary;
    doc.text(`District: ${b?.district?.name || 'N/A'}`, 300, 178);
    doc.text(`Block: ${b?.block?.name || 'N/A'}`, 300, 194);
    doc.text(`Revenue Village: ${b?.village?.name || 'N/A'}`, 300, 210);
    if (b?.address_line_1) {
      doc.text(`Address: ${b.address_line_1}`, 55, 226);
    }

    // Section 2: Water Allocation & Land Holding Particulars (context-aware: dev bill vs running bill)
    const isRunningBillPayment = !!payment.running_bill_id;
    const runningBill = (payment as any).runningBill;

    doc.rect(40, 252, 515, 90).fill('#f8fafc');
    doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold').text(
      isRunningBillPayment ? '2. RUNNING CHARGES — BILLING PARTICULARS' : '2. WATER ALLOCATION & LAND HOLDING PARTICULARS',
      55, 262,
    );

    const inst = payment.installment;
    const bill = inst?.bill;
    const allot = bill?.allotment;
    const app = allot?.application;
    const land = app?.landHolding;

    doc.fontSize(8.5).font('Helvetica').fillColor('#475569');

    if (isRunningBillPayment && runningBill) {
      // Running bill payment — show periodic charge details
      doc.text(`Bill Number: ${runningBill.bill_number || runningBill.running_bill_id?.slice(0, 8) || 'N/A'}`, 55, 282);
      doc.text(`Billing Period: ${runningBill.billing_period || 'N/A'}`, 55, 298);
      doc.text(`Period Window: ${runningBill.billing_period_start ? new Date(runningBill.billing_period_start).toLocaleDateString('en-IN') : 'N/A'} — ${runningBill.billing_period_end ? new Date(runningBill.billing_period_end).toLocaleDateString('en-IN') : 'N/A'}`, 55, 314);

      doc.text(`Approved Quota: ${runningBill.approved_litres_snapshot ? Number(runningBill.approved_litres_snapshot).toLocaleString('en-IN') + ' L' : 'N/A'}`, 300, 282);
      doc.text(`Running Rate: ₹${runningBill.running_cost_per_litre_snapshot ? Number(runningBill.running_cost_per_litre_snapshot).toFixed(2) : 'N/A'}/L`, 300, 298);
      doc.text(`Tariff Version: ${runningBill.tariff_version || 'STANDARD'}`, 300, 314);
    } else {
      // Development bill / installment payment
      doc.text(`Land Holding ID: ${land ? land.land_id.slice(0, 8) + '...' : 'N/A'}`, 55, 282);
      doc.text(`Declared Area: ${land ? Number(land.declared_total_area).toFixed(2) + ' ACRES' : 'N/A'}`, 55, 298);
      doc.text(`Water App #: ${app ? '#' + app.application_id.slice(0, 8) : 'N/A'}`, 55, 314);

      doc.text(`Approved Quota: ${allot ? Number(allot.approved_litres).toLocaleString('en-IN') + ' L' : 'N/A'}`, 300, 282);
      doc.text(`Historical Tariff Rate: ${bill ? '₹' + Number(bill.development_cost_per_litre_snapshot).toFixed(2) + '/L' : 'N/A'}`, 300, 298);
      doc.text(`Development Bill #: ${bill ? '#' + bill.bill_id.slice(0, 8) : 'N/A'}`, 300, 314);
    }

    // Section 3: Payment Breakdown Table (context-aware)
    const sectionThreeLabel = isRunningBillPayment
      ? '3. RECURRING RUNNING CHARGE SETTLEMENT'
      : '3. PAYMENT & INSTALLMENT SETTLEMENT';

    doc.rect(40, 350, 515, 130).fill('#ffffff').stroke('#cbd5e1');
    doc.rect(40, 350, 515, 22).fill(isRunningBillPayment ? '#ecfeff' : '#e2e8f0');
    doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold').text(sectionThreeLabel, 55, 356);

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#334155');
    doc.text('Description', 55, 380);
    doc.text('Charge Type', 280, 380);
    doc.text('Due Amount', 360, 380, { align: 'right', width: 80 });
    doc.text('Paid in Transaction', 450, 380, { align: 'right', width: 90 });

    doc.moveTo(40, 395).lineTo(555, 395).stroke('#cbd5e1');

    doc.font('Helvetica').fillColor('#1e293b');
    const milestoneName = isRunningBillPayment
      ? `Running Charges — ${runningBill?.billing_period || 'Recurring Cycle'}`
      : inst
      ? `Stage #${inst.installment_number} Milestone Payment`
      : 'Water Development Settlement';
    const stagePct = isRunningBillPayment ? 'RECURRING' : inst ? `${Number(inst.percentage).toFixed(1)}%` : '100.0%';
    const dueAmt = isRunningBillPayment && runningBill
      ? `₹${Number(runningBill.amount_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : inst
      ? `₹${Number(inst.amount_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : '₹0.00';
    const paidAmt = `₹${Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    doc.text(milestoneName, 55, 405);
    doc.text(stagePct, 280, 405);
    doc.text(dueAmt, 360, 405, { align: 'right', width: 80 });
    doc.font('Helvetica-Bold').fillColor(isReversed ? '#dc2626' : '#15803d').text(paidAmt, 450, 405, { align: 'right', width: 90 });

    doc.moveTo(40, 425).lineTo(555, 425).stroke('#cbd5e1');

    doc.font('Helvetica').fillColor('#475569');
    doc.text(`Payment Reference / UTR: ${payment.payment_reference || 'N/A'}`, 55, 435);
    doc.text(`Recorded By Officer: ${payment.recorded_by || 'Accounts Admin'}`, 55, 450);
    if (payment.remarks) {
      doc.text(`Remarks / Notes: ${payment.remarks}`, 55, 465);
    }

    // Amount in Words Box
    doc.rect(40, 490, 515, 35).fill('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('NET TRANSACTION VALUE:', 55, 500);
    doc.fillColor('#0369a1').fontSize(11).font('Helvetica-Bold').text(
      `INR ₹${Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      210,
      498,
    );

    // Legal / Audit Seal Footer
    doc.rect(40, 540, 515, 60).fill('#f8fafc');
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b');
    doc.text(
      'This is an authoritative computer-generated digital payment receipt issued by the Kongu Basin Water Allocation Authority.',
      55,
      550,
      { width: 485 },
    );
    doc.text(
      'All transactions are immutably logged in the system cryptographic audit ledger. Tampering or duplication is strictly prohibited under the Water Regulation Act.',
      55,
      565,
      { width: 485 },
    );
    doc.text(`Digital Verification Hash: SHA256-${payment.payment_id.replace(/-/g, '').slice(0, 24).toUpperCase()}`, 55, 582);

    doc.end();

    const buffer = await pdfPromise;
    const fileName = `Payment_Receipt_${payment.receipt_number}.pdf`;
    return { buffer, fileName };
  }

  /**
   * Explicit financial deletion rejection guard (RUN-NEW-044).
   * Financial payment records are strictly immutable and cannot be deleted.
   */
  async deletePayment(paymentId: string): Promise<never> {
    throw new BadRequestException('Financial payment records are immutable and cannot be deleted. Use payment reversal if authorized.');
  }

  private generateReceiptNumber(prefix = 'REC'): string {
    const year = new Date().getFullYear();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.floor(100000 + Math.random() * 900000).toString();
    return `${prefix}-${year}-${randomHex}`;
  }
}
