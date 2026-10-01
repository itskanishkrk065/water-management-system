import { getDatabase } from '../db/database';
import { SyncQueueItem, SyncSummary } from '../types/sync';

export class SyncRepository {
  /**
   * Get all items in the sync queue
   */
  async getQueue(): Promise<SyncQueueItem[]> {
    const db = await getDatabase();
    return await db.getAllAsync<SyncQueueItem>(
      'SELECT * FROM sync_queue ORDER BY created_at DESC;'
    );
  }

  /**
   * Get summary counts of sync queue
   */
  async getSummary(): Promise<SyncSummary> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ status: string; count: number }>(`
      SELECT status, COUNT(*) as count 
      FROM sync_queue 
      GROUP BY status;
    `);

    const summary: SyncSummary = {
      pending: 0,
      in_progress: 0,
      failed: 0,
      conflict: 0,
      completed: 0,
      total: 0,
    };

    for (const r of rows) {
      if (r.status === 'PENDING') summary.pending = r.count;
      else if (r.status === 'IN_PROGRESS') summary.in_progress = r.count;
      else if (r.status === 'FAILED') summary.failed = r.count;
      else if (r.status === 'CONFLICT') summary.conflict = r.count;
      else if (r.status === 'COMPLETED') summary.completed = r.count;
      summary.total = (summary.total || 0) + r.count;
    }

    // Get last synced timestamp from audit or sync queue
    const lastSyncRow = await db.getFirstAsync<{ last_synced: string }>(`
      SELECT MAX(last_synced_at) as last_synced FROM beneficiaries;
    `);
    summary.last_sync_timestamp = lastSyncRow?.last_synced || undefined;

    return summary;
  }

  /**
   * Clear all or completed sync queue items
   */
  async clearQueue(onlyCompleted: boolean = false): Promise<number> {
    const db = await getDatabase();
    let res;
    if (onlyCompleted) {
      res = await db.runAsync('DELETE FROM sync_queue WHERE status = "COMPLETED";');
    } else {
      res = await db.runAsync('DELETE FROM sync_queue;');
    }
    return res.changes;
  }

  /**
   * Simulate sync process (processes all pending items, updates local entity sync_status to SYNCED)
   */
  async processPendingSync(): Promise<{ processed: number; successCount: number; failCount: number }> {
    const db = await getDatabase();
    const pendingItems = await db.getAllAsync<SyncQueueItem>(
      'SELECT * FROM sync_queue WHERE status IN ("PENDING", "FAILED") ORDER BY created_at ASC;'
    );

    let successCount = 0;
    const now = new Date().toISOString();

    for (const item of pendingItems) {
      await db.withTransactionAsync(async () => {
        // Mark item completed in queue
        await db.runAsync(`
          UPDATE sync_queue 
          SET status = 'COMPLETED', attempt_count = attempt_count + 1, last_attempt_at = ?
          WHERE id = ?;
        `, [now, item.id]);

        // Update target entity sync_status to SYNCED
        if (item.entity_type === 'BENEFICIARY') {
          await db.runAsync('UPDATE beneficiaries SET sync_status = "SYNCED", last_synced_at = ? WHERE beneficiary_id = ?;', [now, item.entity_id]);
        } else if (item.entity_type === 'LAND_HOLDING') {
          await db.runAsync('UPDATE land_holdings SET sync_status = "SYNCED", last_synced_at = ? WHERE holding_id = ?;', [now, item.entity_id]);
        } else if (item.entity_type === 'WATER_APPLICATION') {
          await db.runAsync('UPDATE water_applications SET sync_status = "SYNCED", last_synced_at = ? WHERE application_id = ?;', [now, item.entity_id]);
        } else if (item.entity_type === 'PAYMENT') {
          await db.runAsync('UPDATE payments SET sync_status = "SYNCED", last_synced_at = ? WHERE payment_id = ?;', [now, item.entity_id]);
        }
      });
      successCount++;
    }

    return {
      processed: pendingItems.length,
      successCount,
      failCount: 0,
    };
  }

  /**
   * Retry a failed item
   */
  async retryItem(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE sync_queue SET status = "PENDING", last_error = NULL WHERE id = ?;', [id]);
  }
}
