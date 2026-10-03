import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { DecimalUtil } from '../common/decimal.util';
import { SyncEnvelopeDto } from './dto/sync.dto';

export interface ConflictEvaluationResult {
  isConflict: boolean;
  conflictType?: 'VERSION_MISMATCH' | 'RECORD_NOT_FOUND' | 'STATUS_CONFLICT' | 'BUSINESS_RULE_VIOLATION';
  expectedVersion?: number;
  actualVersion?: number;
  reason?: string;
  hasOverpayment?: boolean;
  applicableAmount?: Decimal;
  excessAmount?: Decimal;
  billId?: string;
  beneficiaryId?: string;
}

@Injectable()
export class SyncConflictService {
  private readonly logger = new Logger(SyncConflictService.name);

  /**
   * Evaluates optimistic concurrency and domain-specific conflict rules
   * for an incoming sync envelope within a transaction context.
   */
  async evaluateConflict(
    envelope: SyncEnvelopeDto,
    tx: Prisma.TransactionClient,
  ): Promise<ConflictEvaluationResult> {
    // 1. Optimistic Concurrency / Version Mismatch Check
    if (envelope.expectedVersion !== undefined && envelope.expectedVersion !== null) {
      const currentVersion = await this.getCurrentEntityVersion(
        envelope.entityType,
        envelope.entityId,
        tx,
      );

      if (currentVersion !== null && currentVersion !== envelope.expectedVersion) {
        return {
          isConflict: true,
          conflictType: 'VERSION_MISMATCH',
          expectedVersion: envelope.expectedVersion,
          actualVersion: currentVersion,
          reason: `Version mismatch on ${envelope.entityType} ${envelope.entityId}. Client expected version ${envelope.expectedVersion}, but server has version ${currentVersion}.`,
        };
      }
    }

    // 2. Business Conflict: Payment Overpayment Arbitration (Part 10 & §117)
    // If offline payment amount exceeds current pending amount on server (e.g. concurrent payments),
    // we accept payment up to pending amount, and auto-route excess into BeneficiaryAdvanceLedger.
    if (envelope.operationType === 'RECORD_PAYMENT') {
      const payload = envelope.payloadJson;
      const paymentAmount = new Decimal(payload.amount || 0);

      const runningBillId = payload.runningBillId || payload.running_bill_id;
      const installmentId = payload.installmentId || payload.installment_id;

      if (runningBillId) {
        const runningBill = await (tx as any).runningBill.findUnique({
          where: { running_bill_id: runningBillId },
        });

        if (runningBill) {
          const pending = new Decimal(runningBill.pending_amount);
          if (paymentAmount.gt(pending)) {
            const applicable = Decimal.max(0, pending);
            const excess = DecimalUtil.roundMoney(paymentAmount.minus(applicable));
            return {
              isConflict: false,
              hasOverpayment: true,
              applicableAmount: applicable,
              excessAmount: excess,
              billId: runningBill.running_bill_id,
              beneficiaryId: runningBill.beneficiary_id,
              reason: `Payment ₹${paymentAmount.toFixed(2)} exceeds pending balance ₹${pending.toFixed(2)}. ₹${applicable.toFixed(2)} applied to bill; ₹${excess.toFixed(2)} routed to BeneficiaryAdvanceLedger.`,
            };
          }
        }
      } else if (installmentId) {
        const installment = await (tx as any).installment.findUnique({
          where: { installment_id: installmentId },
          include: { bill: true },
        });

        if (installment) {
          const pending = new Decimal(installment.pending_amount);
          if (paymentAmount.gt(pending)) {
            const applicable = Decimal.max(0, pending);
            const excess = DecimalUtil.roundMoney(paymentAmount.minus(applicable));
            return {
              isConflict: false,
              hasOverpayment: true,
              applicableAmount: applicable,
              excessAmount: excess,
              billId: installment.installment_id,
              beneficiaryId: installment.bill?.beneficiary_id,
              reason: `Installment payment ₹${paymentAmount.toFixed(2)} exceeds pending balance ₹${pending.toFixed(2)}. ₹${applicable.toFixed(2)} applied to installment; ₹${excess.toFixed(2)} routed to BeneficiaryAdvanceLedger.`,
            };
          }
        }
      }
    }

    return { isConflict: false };
  }

  /**
   * Resolves the current version of an aggregate by entity type.
   */
  private async getCurrentEntityVersion(
    entityType: string,
    entityId: string,
    tx: Prisma.TransactionClient,
  ): Promise<number | null> {
    const client = tx as any;
    try {
      switch (entityType.toLowerCase()) {
        case 'beneficiary': {
          const b = await client.beneficiary.findUnique({
            where: { beneficiary_id: entityId },
            select: { version: true },
          });
          return b?.version ?? null;
        }
        case 'landholding': {
          const l = await client.landHolding.findUnique({
            where: { land_id: entityId },
            select: { version: true },
          });
          return l?.version ?? null;
        }
        case 'waterapplication': {
          const a = await client.waterApplication.findUnique({
            where: { application_id: entityId },
            select: { version: true },
          });
          return a?.version ?? null;
        }
        case 'waterallotment': {
          const al = await client.waterAllotment.findUnique({
            where: { allotment_id: entityId },
            select: { version: true },
          });
          return al?.version ?? null;
        }
        case 'developmentbill': {
          const db = await client.developmentBill.findUnique({
            where: { bill_id: entityId },
            select: { version: true },
          });
          return db?.version ?? null;
        }
        case 'installment': {
          const inst = await client.installment.findUnique({
            where: { installment_id: entityId },
            select: { version: true },
          });
          return inst?.version ?? null;
        }
        case 'infrastructure': {
          const inf = await client.infrastructure.findUnique({
            where: { infrastructure_id: entityId },
            select: { version: true },
          });
          return inf?.version ?? null;
        }
        case 'runningbill': {
          const rb = await client.runningBill.findUnique({
            where: { running_bill_id: entityId },
            select: { version: true },
          });
          return rb?.version ?? null;
        }
        case 'extension': {
          const ext = await client.extension.findUnique({
            where: { extension_id: entityId },
            select: { version: true },
          });
          return ext?.version ?? null;
        }
        default:
          return null;
      }
    } catch (e) {
      this.logger.warn(`Could not resolve version for ${entityType} ${entityId}: ${e}`);
      return null;
    }
  }
}
