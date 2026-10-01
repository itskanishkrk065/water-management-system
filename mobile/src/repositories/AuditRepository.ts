import { getDatabase } from '../db/database';
import { LocalAuditEvent } from '../types/audit';

export class AuditRepository {
  /**
   * Get recent audit events
   */
  async getRecent(limit: number = 50): Promise<LocalAuditEvent[]> {
    const db = await getDatabase();
    return await db.getAllAsync<LocalAuditEvent>(
      'SELECT * FROM local_audit_logs ORDER BY timestamp DESC LIMIT ?;',
      [limit]
    );
  }

  /**
   * Get audit events for a specific entity
   */
  async getByEntityId(entityType: string, entityId: string): Promise<LocalAuditEvent[]> {
    const db = await getDatabase();
    return await db.getAllAsync<LocalAuditEvent>(
      'SELECT * FROM local_audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp DESC;',
      [entityType, entityId]
    );
  }

  /**
   * Record a local audit log
   */
  async log(event: Omit<LocalAuditEvent, 'audit_id' | 'timestamp' | 'sync_status'>): Promise<void> {
    const db = await getDatabase();
    const auditId = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    await db.runAsync(`
      INSERT INTO local_audit_logs (
        audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'LOCAL_ONLY');
    `, [
      auditId,
      event.user_id,
      event.user_role,
      event.device_id,
      event.entity_type,
      event.entity_id,
      event.action,
      event.details_json || null,
      now,
    ]);
  }
}
