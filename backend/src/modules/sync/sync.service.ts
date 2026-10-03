import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SyncConflictService } from './sync-conflict.service';
import { ApplicationClockService } from '../system/application-clock.service';
import { PaymentsService } from '../payments/payments.service';
import {
  SyncPushDto,
  SyncPullQueryDto,
  SyncAckDto,
  RegisterDeviceDto,
  RevokeDeviceDto,
  SyncEnvelopeDto,
} from './dto/sync.dto';
import { AuditAction, AuditEntityType, PaymentMode } from '../common/enums';
import * as crypto from 'crypto';
import { Decimal } from 'decimal.js';
import { DecimalUtil } from '../common/decimal.util';

export interface SyncOperationResult {
  clientOpId: string;
  status: 'APPLIED' | 'ALREADY_ACCEPTED' | 'CONFLICT' | 'REJECTED';
  code: string;
  message?: string;
  data?: any;
  conflict?: any;
}

export interface SyncPushResponse {
  appliedCount: number;
  alreadyAcceptedCount: number;
  conflictCount: number;
  rejectedCount: number;
  results: SyncOperationResult[];
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly conflictService: SyncConflictService,
    @Optional() private readonly clock?: ApplicationClockService,
    @Optional() private readonly paymentsService?: PaymentsService,
  ) {}

  /**
   * Registers a client device or field tablet for synchronization.
   */
  async registerDevice(dto: RegisterDeviceDto, actorUserId?: string): Promise<any> {
    const existing = await (this.prisma as any).deviceRegistration.findUnique({
      where: { device_id: dto.deviceId },
    });

    const device = await (this.prisma as any).deviceRegistration.upsert({
      where: { device_id: dto.deviceId },
      create: {
        device_id: dto.deviceId,
        device_name: dto.deviceName,
        app_version: dto.appVersion,
        is_active: true,
        registered_at: new Date(),
        last_sync_at: new Date(),
        last_ack_feed_id: 0,
      },
      update: {
        device_name: dto.deviceName,
        app_version: dto.appVersion,
        is_active: true,
        revoked_at: null,
        last_sync_at: new Date(),
      },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: 'DeviceRegistration',
      entityId: device.device_id,
      newValues: { deviceId: device.device_id, deviceName: device.device_name, appVersion: device.app_version },
      reason: `Device ${device.device_id} (${device.device_name}) registered for WaterGrid sync`,
    });

    return device;
  }

  /**
   * Revokes a device's synchronization privileges.
   */
  async revokeDevice(dto: RevokeDeviceDto, actorUserId?: string): Promise<any> {
    const device = await (this.prisma as any).deviceRegistration.findUnique({
      where: { device_id: dto.deviceId },
    });
    if (!device) {
      throw new NotFoundException(`Device ${dto.deviceId} not found`);
    }

    const updated = await (this.prisma as any).deviceRegistration.update({
      where: { device_id: dto.deviceId },
      data: {
        is_active: false,
        revoked_at: new Date(),
      },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: AuditAction.UPDATE,
      entityType: 'DeviceRegistration',
      entityId: device.device_id,
      oldValues: { is_active: device.is_active },
      newValues: { is_active: false, revoked_at: updated.revoked_at },
      reason: `Device ${dto.deviceId} revoked: ${dto.reason}`,
    });

    return updated;
  }

  /**
   * Returns current sync server health, active epoch, max feed ID, and device status.
   */
  async getSyncStatus(deviceId?: string): Promise<any> {
    const maxFeed = await (this.prisma as any).serverChangeFeed.findFirst({
      orderBy: { feed_id: 'desc' },
      select: { feed_id: true },
    });

    let device: any = null;
    if (deviceId) {
      const reg = await (this.prisma as any).deviceRegistration.findUnique({
        where: { device_id: deviceId },
      });
      if (reg) {
        device = {
          deviceId: reg.device_id,
          deviceName: reg.device_name,
          isActive: reg.is_active,
          lastAckFeedId: reg.last_ack_feed_id,
          lastSyncAt: reg.last_sync_at,
          registeredAt: reg.registered_at,
        };
      }
    }

    return {
      serverTime: new Date().toISOString(),
      activeEpoch: 'WATERGRID_V2_2026',
      latestFeedId: maxFeed?.feed_id || 0,
      device,
    };
  }

  /**
   * Ingests a batch of SyncOutbox envelopes from an edge/desktop device.
   * Enforces idempotency via request hashing, version checks, and atomic transactions.
   */
  async processPush(
    dto: SyncPushDto,
    actorUserId?: string,
    ipAddress?: string,
  ): Promise<SyncPushResponse> {
    // 1. Verify device authorization
    const device = await (this.prisma as any).deviceRegistration.findUnique({
      where: { device_id: dto.deviceId },
    });

    if (!device) {
      throw new ForbiddenException(
        `DEVICE_UNREGISTERED: Device '${dto.deviceId}' is not registered with the central authority.`,
      );
    }
    if (!device.is_active) {
      throw new ForbiddenException(
        `DEVICE_REVOKED: Device '${dto.deviceId}' has been revoked. All sync operations are blocked.`,
      );
    }

    const results: SyncOperationResult[] = [];
    let appliedCount = 0;
    let alreadyAcceptedCount = 0;
    let conflictCount = 0;
    let rejectedCount = 0;

    for (const envelope of dto.operations) {
      try {
        const payloadStr = JSON.stringify(envelope.payloadJson || {});
        const requestHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

        // 2. Idempotency Check
        const existingOp = await (this.prisma as any).syncOperation.findUnique({
          where: { client_op_id: envelope.clientOpId },
        });

        if (existingOp) {
          const existingPayload = typeof existingOp.payload_json === 'string'
            ? existingOp.payload_json
            : JSON.stringify(existingOp.payload_json);
          const existingHash = crypto.createHash('sha256').update(existingPayload).digest('hex');

          if (existingHash === requestHash) {
            alreadyAcceptedCount++;
            results.push({
              clientOpId: envelope.clientOpId,
              status: 'ALREADY_ACCEPTED',
              code: 'ALREADY_ACCEPTED',
              message: 'Operation was previously applied with identical payload.',
              data: typeof existingOp.payload_json === 'string' ? JSON.parse(existingOp.payload_json) : existingOp.payload_json,
            });
            continue;
          } else {
            rejectedCount++;
            results.push({
              clientOpId: envelope.clientOpId,
              status: 'REJECTED',
              code: 'IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_PAYLOAD',
              message: `ClientOpId '${envelope.clientOpId}' was already submitted with a different payload hash.`,
            });
            continue;
          }
        }

        // 3. Process Domain Operation inside an atomic transaction
        const opResult = await this.prisma.$transaction(async (tx) => {
          // Concurrency / Conflict Evaluation
          const conflictEval = await this.conflictService.evaluateConflict(envelope, tx);

          if (conflictEval.isConflict) {
            await (tx as any).syncOperation.create({
              data: {
                client_op_id: envelope.clientOpId,
                device_id: dto.deviceId,
                entity_type: envelope.entityType,
                entity_id: envelope.entityId,
                operation_type: envelope.operationType,
                payload_json: payloadStr,
                schema_version: envelope.schemaVersion || 1,
                status: 'CONFLICT',
              },
            });

            return {
              clientOpId: envelope.clientOpId,
              status: 'CONFLICT' as const,
              code: conflictEval.conflictType || 'VERSION_MISMATCH',
              conflict: conflictEval,
              message: conflictEval.reason,
            };
          }

          // Apply Domain Logic
          let appliedData: any = null;
          let newVersion = 1;

          if (envelope.operationType === 'RECORD_PAYMENT') {
            appliedData = await this.applyPaymentOperation(envelope, conflictEval, tx, actorUserId, ipAddress);
          } else if (envelope.operationType === 'RECORD_USAGE') {
            appliedData = await this.applyUsageOperation(envelope, tx);
          } else if (envelope.operationType === 'UPDATE_BENEFICIARY') {
            appliedData = await this.applyBeneficiaryUpdate(envelope, tx);
            newVersion = appliedData?.version || 1;
          } else {
            // Default generic entity version update
            newVersion = await this.incrementEntityVersion(envelope.entityType, envelope.entityId, tx);
            appliedData = envelope.payloadJson;
          }

          // 4. Record applied SyncOperation
          await (tx as any).syncOperation.create({
            data: {
              client_op_id: envelope.clientOpId,
              device_id: dto.deviceId,
              entity_type: envelope.entityType,
              entity_id: envelope.entityId,
              operation_type: envelope.operationType,
              payload_json: payloadStr,
              schema_version: envelope.schemaVersion || 1,
              status: 'APPLIED',
              applied_at: new Date(),
            },
          });

          // 5. Append to ServerChangeFeed
          const feedEntry = await (tx as any).serverChangeFeed.create({
            data: {
              entity_type: envelope.entityType,
              entity_id: envelope.entityId,
              operation_type: envelope.operationType,
              payload_json: payloadStr,
              version: newVersion,
              origin_device_id: dto.deviceId,
            },
          });

          return {
            clientOpId: envelope.clientOpId,
            status: 'APPLIED' as const,
            code: 'SUCCESS',
            data: { ...appliedData, feedId: feedEntry.feed_id },
          };
        });

        if (opResult.status === 'APPLIED') {
          appliedCount++;
        } else if (opResult.status === 'CONFLICT') {
          conflictCount++;
        }
        results.push(opResult);
      } catch (err: any) {
        this.logger.error(`Error processing envelope ${envelope.clientOpId}: ${err.message}`, err.stack);
        rejectedCount++;
        results.push({
          clientOpId: envelope.clientOpId,
          status: 'REJECTED',
          code: 'EXECUTION_ERROR',
          message: err.message || 'Internal error processing sync operation',
        });
      }
    }

    // Update device last_sync_at
    await (this.prisma as any).deviceRegistration.update({
      where: { device_id: dto.deviceId },
      data: { last_sync_at: new Date() },
    });

    return {
      appliedCount,
      alreadyAcceptedCount,
      conflictCount,
      rejectedCount,
      results,
    };
  }

  /**
   * Pulls incremental server changes since a given feed ID cursor.
   */
  async processPull(sinceFeedId: number = 0, limit: number = 100): Promise<any> {
    const safeLimit = Math.min(Math.max(1, limit), 500);

    const changes = await (this.prisma as any).serverChangeFeed.findMany({
      where: {
        feed_id: { gt: sinceFeedId },
      },
      orderBy: { feed_id: 'asc' },
      take: safeLimit + 1,
    });

    const hasMore = changes.length > safeLimit;
    const returnChanges = hasMore ? changes.slice(0, safeLimit) : changes;
    const latestFeedId = returnChanges.length > 0 ? returnChanges[returnChanges.length - 1].feed_id : sinceFeedId;

    return {
      changes: returnChanges.map((c: any) => ({
        feedId: c.feed_id,
        entityType: c.entity_type,
        entityId: c.entity_id,
        operationType: c.operation_type,
        payload: typeof c.payload_json === 'string' ? JSON.parse(c.payload_json) : c.payload_json,
        version: c.version,
        originDeviceId: c.origin_device_id,
        createdAt: c.created_at,
      })),
      latestFeedId,
      hasMore,
    };
  }

  /**
   * Acknowledges client processed feed ID.
   */
  async processAck(dto: SyncAckDto): Promise<any> {
    const updated = await (this.prisma as any).deviceRegistration.update({
      where: { device_id: dto.deviceId },
      data: {
        last_ack_feed_id: dto.acknowledgedFeedId,
        last_sync_at: new Date(),
      },
    });

    return {
      deviceId: updated.device_id,
      acknowledgedFeedId: updated.last_ack_feed_id,
      lastSyncAt: updated.last_sync_at,
    };
  }

  // ==========================================
  // DOMAIN HANDLERS
  // ==========================================

  private async applyPaymentOperation(
    envelope: SyncEnvelopeDto,
    conflictEval: any,
    tx: any,
    actorUserId?: string,
    ipAddress?: string,
  ): Promise<any> {
    const payload = envelope.payloadJson;
    const totalAmount = new Decimal(payload.amount);
    const applicableAmount = conflictEval.hasOverpayment ? conflictEval.applicableAmount : totalAmount;
    const excessAmount = conflictEval.hasOverpayment ? conflictEval.excessAmount : new Decimal(0);

    // 1. Record primary payment
    const payment = await tx.payment.create({
      data: {
        beneficiary_id: payload.beneficiaryId || conflictEval.beneficiaryId,
        running_bill_id: payload.runningBillId || null,
        installment_id: payload.installmentId || null,
        extension_id: payload.extensionId || null,
        amount: applicableAmount,
        payment_date: payload.paymentDate ? new Date(payload.paymentDate) : new Date(),
        payment_reference: payload.paymentReference || null,
        receipt_number: payload.receiptNumber || `SYNC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        payment_mode: payload.paymentMode || PaymentMode.CASH,
        recorded_by: payload.recordedBy || 'Field Agent (Sync)',
      },
    });

    // 2. Adjust Running Bill Balance if applicable
    if (payload.runningBillId) {
      const rb = await tx.runningBill.findUnique({
        where: { running_bill_id: payload.runningBillId },
      });
      if (rb) {
        const newPaid = DecimalUtil.roundMoney(DecimalUtil.add(new Decimal(rb.amount_paid), applicableAmount));
        const newPending = DecimalUtil.roundMoney(Decimal.max(0, DecimalUtil.sub(new Decimal(rb.amount_due), newPaid)));
        const newStatus = newPending.isZero() ? 'PAID' : 'PARTIALLY_PAID';

        await tx.runningBill.update({
          where: { running_bill_id: rb.running_bill_id },
          data: {
            amount_paid: newPaid,
            pending_amount: newPending,
            status: newStatus,
            version: { increment: 1 },
          },
        });
      }
    }

    // 3. Auto-route excess payment into BeneficiaryAdvanceLedger if overpayment occurred
    let advanceRecord: any = null;
    if (conflictEval.hasOverpayment && excessAmount.gt(0)) {
      advanceRecord = await tx.beneficiaryAdvanceLedger.create({
        data: {
          beneficiary_id: payload.beneficiaryId || conflictEval.beneficiaryId,
          amount: excessAmount,
          consumed_amount: new Decimal(0),
          balance_amount: excessAmount,
          reference_type: 'OVERPAYMENT_ARBITRATION',
          reference_id: payment.payment_id,
        },
      });

      this.logger.log(
        `[SyncArbitration] Overpayment detected: ₹${excessAmount.toFixed(2)} routed to BeneficiaryAdvanceLedger (${advanceRecord.advance_id}) for Beneficiary ${payload.beneficiaryId}`,
      );
    }

    return {
      payment,
      overpaymentRoutedToAdvance: conflictEval.hasOverpayment,
      advanceRecord,
    };
  }

  private async applyUsageOperation(envelope: SyncEnvelopeDto, tx: any): Promise<any> {
    const payload = envelope.payloadJson;

    const record = await tx.waterUsageRecord.upsert({
      where: {
        allotment_id_billing_period_id: {
          allotment_id: payload.allotmentId,
          billing_period_id: payload.billingPeriodId,
        },
      },
      create: {
        beneficiary_id: payload.beneficiaryId,
        allotment_id: payload.allotmentId,
        infrastructure_id: payload.infrastructureId || null,
        billing_period_id: payload.billingPeriodId,
        collection_agent_id: payload.collectionAgentId || null,
        usage_period_start: new Date(payload.usagePeriodStart),
        usage_period_end: new Date(payload.usagePeriodEnd),
        collection_date: new Date(payload.collectionDate || new Date()),
        actual_usage_litres: new Decimal(payload.actualUsageLitres),
        approved_litres_snapshot: new Decimal(payload.approvedLitresSnapshot || payload.actualUsageLitres),
        usage_entry_mode: payload.usageEntryMode || 'DIRECT',
        previous_meter_reading: payload.previousMeterReading ? new Decimal(payload.previousMeterReading) : null,
        current_meter_reading: payload.currentMeterReading ? new Decimal(payload.currentMeterReading) : null,
        running_rate_snapshot: new Decimal(payload.runningRateSnapshot || 0.0085),
        tariff_id: payload.tariffId || null,
        calculated_amount: new Decimal(payload.calculatedAmount || 0),
        status: 'RECORDED',
        notes: payload.notes || 'Ingested via WaterGrid edge sync',
      },
      update: {
        actual_usage_litres: new Decimal(payload.actualUsageLitres),
        calculated_amount: new Decimal(payload.calculatedAmount || 0),
        collection_date: new Date(payload.collectionDate || new Date()),
        notes: payload.notes || 'Updated via WaterGrid edge sync',
      },
    });

    return record;
  }

  private async applyBeneficiaryUpdate(envelope: SyncEnvelopeDto, tx: any): Promise<any> {
    const payload = envelope.payloadJson;
    return tx.beneficiary.update({
      where: { beneficiary_id: envelope.entityId },
      data: {
        name: payload.name,
        phone_number: payload.phoneNumber,
        address_line_1: payload.addressLine1,
        pincode: payload.pincode,
        version: { increment: 1 },
      },
    });
  }

  private async incrementEntityVersion(entityType: string, entityId: string, tx: any): Promise<number> {
    try {
      const modelName = entityType.charAt(0).toLowerCase() + entityType.slice(1);
      if (tx[modelName] && tx[modelName].update) {
        const updated = await tx[modelName].update({
          where: { [`${modelName}_id`]: entityId },
          data: { version: { increment: 1 } },
          select: { version: true },
        });
        return updated.version;
      }
    } catch {
      // Ignored if entity does not follow standard naming
    }
    return 1;
  }
}
