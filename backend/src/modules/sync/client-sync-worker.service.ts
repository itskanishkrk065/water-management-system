import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from './sync.service';
import { SyncEnvelopeDto } from './dto/sync.dto';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

export type SyncNetworkState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ATTENTION_REQUIRED';

export interface ClientSyncStatus {
  state: SyncNetworkState;
  deviceId: string;
  pendingOutboxCount: number;
  conflictCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
  nextRetryMs?: number;
}

@Injectable()
export class ClientSyncWorkerService {
  private readonly logger = new Logger(ClientSyncWorkerService.name);
  private currentState: SyncNetworkState = 'ONLINE';
  private lastSyncAt: Date | null = null;
  private lastError: string | null = null;
  private deviceId: string = 'DESKTOP-DEFAULT-CLIENT';

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
  ) {}

  public setDeviceId(deviceId: string) {
    this.deviceId = deviceId;
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getState(): SyncNetworkState {
    return this.currentState;
  }

  /**
   * Helper to write a local operation and enqueue it into SyncOutbox atomically.
   */
  async enqueueOperation(
    envelope: Omit<SyncEnvelopeDto, 'clientOpId'> & { clientOpId?: string },
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const clientOpId = envelope.clientOpId || crypto.randomUUID();
    const payloadStr = JSON.stringify(envelope.payloadJson);

    const client = (tx || this.prisma) as any;
    const outboxItem = await client.syncOutbox.create({
      data: {
        client_op_id: clientOpId,
        device_id: this.deviceId,
        entity_type: envelope.entityType,
        entity_id: envelope.entityId,
        operation_type: envelope.operationType,
        payload_json: payloadStr,
        schema_version: envelope.schemaVersion || 1,
        status: 'PENDING',
        retry_count: 0,
      },
    });

    return outboxItem;
  }

  /**
   * Drains pending items from the local SyncOutbox and submits them to the sync engine.
   */
  async drainOutbox(batchSize: number = 50): Promise<{
    processedCount: number;
    appliedCount: number;
    conflictCount: number;
    failedCount: number;
  }> {
    const client = this.prisma as any;
    const pendingItems = await client.syncOutbox.findMany({
      where: {
        status: { in: ['PENDING', 'RETRYING'] },
      },
      orderBy: { created_at: 'asc' },
      take: batchSize,
    });

    if (pendingItems.length === 0) {
      const conflicts = await client.syncOutbox.count({ where: { status: 'CONFLICT' } });
      this.currentState = conflicts > 0 ? 'ATTENTION_REQUIRED' : 'ONLINE';
      return { processedCount: 0, appliedCount: 0, conflictCount: 0, failedCount: 0 };
    }

    this.currentState = 'SYNCING';

    const operations: SyncEnvelopeDto[] = pendingItems.map((item: any) => ({
      clientOpId: item.client_op_id,
      operationType: item.operation_type,
      entityType: item.entity_type,
      entityId: item.entity_id,
      payloadJson: typeof item.payload_json === 'string' ? JSON.parse(item.payload_json) : item.payload_json,
      schemaVersion: item.schema_version,
    }));

    try {
      const pushResponse = await this.syncService.processPush({
        deviceId: this.deviceId,
        operations,
      });

      let appliedCount = 0;
      let conflictCount = 0;
      let failedCount = 0;

      for (const res of pushResponse.results) {
        if (res.status === 'APPLIED' || res.status === 'ALREADY_ACCEPTED') {
          appliedCount++;
          await client.syncOutbox.update({
            where: { client_op_id: res.clientOpId },
            data: {
              status: 'ACKNOWLEDGED',
              synced_at: new Date(),
              last_error: null,
            },
          });
        } else if (res.status === 'CONFLICT') {
          conflictCount++;
          await client.syncOutbox.update({
            where: { client_op_id: res.clientOpId },
            data: {
              status: 'CONFLICT',
              last_error: res.message || 'Optimistic concurrency conflict',
            },
          });
        } else {
          failedCount++;
          await client.syncOutbox.update({
            where: { client_op_id: res.clientOpId },
            data: {
              status: 'REJECTED',
              last_error: res.message || res.code,
            },
          });
        }
      }

      this.lastSyncAt = new Date();
      this.lastError = null;

      if (conflictCount > 0) {
        this.currentState = 'ATTENTION_REQUIRED';
      } else {
        const remainingPending = await client.syncOutbox.count({
          where: { status: { in: ['PENDING', 'RETRYING'] } },
        });
        this.currentState = remainingPending > 0 ? 'SYNCING' : 'ONLINE';
      }

      return {
        processedCount: operations.length,
        appliedCount,
        conflictCount,
        failedCount,
      };
    } catch (err: any) {
      this.logger.warn(`Sync worker push failed: ${err.message}`);
      this.currentState = 'OFFLINE';
      this.lastError = err.message;

      // Increment retry counts and mark RETRYING
      for (const item of pendingItems) {
        const nextRetry = (item.retry_count || 0) + 1;
        await client.syncOutbox.update({
          where: { outbox_id: item.outbox_id },
          data: {
            retry_count: nextRetry,
            status: 'RETRYING',
            last_error: err.message,
          },
        });
      }

      return {
        processedCount: operations.length,
        appliedCount: 0,
        conflictCount: 0,
        failedCount: operations.length,
      };
    }
  }

  /**
   * Pulls incremental server deltas and advances local sync cursor.
   */
  async pullDeltas(lastAckFeedId: number = 0): Promise<{ appliedDeltasCount: number; latestFeedId: number }> {
    try {
      const pullResult = await this.syncService.processPull(lastAckFeedId, 100);

      if (pullResult.changes.length > 0) {
        await this.syncService.processAck({
          deviceId: this.deviceId,
          acknowledgedFeedId: pullResult.latestFeedId,
        });
      }

      return {
        appliedDeltasCount: pullResult.changes.length,
        latestFeedId: pullResult.latestFeedId,
      };
    } catch (err: any) {
      this.logger.warn(`Sync worker pull failed: ${err.message}`);
      this.currentState = 'OFFLINE';
      this.lastError = err.message;
      return { appliedDeltasCount: 0, latestFeedId: lastAckFeedId };
    }
  }

  /**
   * Calculates exponential retry backoff in milliseconds with full jitter.
   */
  computeBackoffMs(retryCount: number): number {
    const baseMs = 1000;
    const maxMs = 60000;
    const exp = Math.min(retryCount, 6);
    const temp = Math.min(maxMs, baseMs * Math.pow(2, exp));
    // Full jitter between 0.5 * temp and temp
    const jitter = temp * (0.5 + Math.random() * 0.5);
    return Math.floor(jitter);
  }

  /**
   * Retrieves overall client sync health and queue diagnostics.
   */
  async getSyncDiagnostics(): Promise<ClientSyncStatus> {
    const client = this.prisma as any;
    const pendingOutboxCount = await client.syncOutbox.count({
      where: { status: { in: ['PENDING', 'RETRYING'] } },
    });
    const conflictCount = await client.syncOutbox.count({
      where: { status: 'CONFLICT' },
    });

    return {
      state: this.currentState,
      deviceId: this.deviceId,
      pendingOutboxCount,
      conflictCount,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
    };
  }
}
