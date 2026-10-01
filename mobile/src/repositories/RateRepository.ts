import { getDatabase } from '../db/database';
import { RateTariff } from '../types/domain';

export interface CreateRateInput {
  project_id: string;
  litres_per_acre: number;
  development_cost_per_litre: number;
  running_cost_per_litre: number;
  effective_from: string;
  reason?: string;
  created_by?: string;
}

export class RateRepository {
  /**
   * Get currently active rate tariff for a project
   */
  async getActiveRate(projectId: string): Promise<RateTariff | null> {
    const db = await getDatabase();
    const sql = `
      SELECT r.*, ps.project_name, ps.project_code
      FROM rate_tariffs r
      JOIN project_schemes ps ON r.project_id = ps.project_id
      WHERE r.project_id = ? AND r.is_active = 1
      ORDER BY r.effective_from DESC
      LIMIT 1;
    `;
    const rate = await db.getFirstAsync<RateTariff>(sql, [projectId]);
    return rate || null;
  }

  /**
   * Get all active rates for all projects
   */
  async getAllActiveRates(): Promise<RateTariff[]> {
    const db = await getDatabase();
    const sql = `
      SELECT r.*, ps.project_name, ps.project_code
      FROM rate_tariffs r
      JOIN project_schemes ps ON r.project_id = ps.project_id
      WHERE r.is_active = 1
      ORDER BY ps.project_name ASC;
    `;
    return db.getAllAsync<RateTariff>(sql);
  }

  /**
   * Get historical versioned rates for a project
   */
  async getRateHistory(projectId: string): Promise<RateTariff[]> {
    const db = await getDatabase();
    const sql = `
      SELECT r.*, ps.project_name, ps.project_code
      FROM rate_tariffs r
      JOIN project_schemes ps ON r.project_id = ps.project_id
      WHERE r.project_id = ?
      ORDER BY r.effective_from DESC;
    `;
    return db.getAllAsync<RateTariff>(sql, [projectId]);
  }

  /**
   * Creates a new version of rate configuration without mutating historical records in place.
   */
  async createNewVersion(input: CreateRateInput): Promise<RateTariff> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const newRateId = `rate-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    await db.withTransactionAsync(async () => {
      // 1. Deactivate current active rate and set effective_to
      await db.runAsync(`
        UPDATE rate_tariffs 
        SET is_active = 0, effective_to = ?
        WHERE project_id = ? AND is_active = 1;
      `, [input.effective_from, input.project_id]);

      // 2. Insert new versioned rate
      await db.runAsync(`
        INSERT INTO rate_tariffs (
          rate_id, project_id, litres_per_acre,
          development_cost_per_litre, running_cost_per_litre,
          effective_from, effective_to, is_active,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?);
      `, [
        newRateId,
        input.project_id,
        input.litres_per_acre,
        input.development_cost_per_litre,
        input.running_cost_per_litre,
        input.effective_from,
        now,
        now,
      ]);

      // 3. Queue sync
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'RATE_TARIFF', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-rate-create-${newRateId}`,
        newRateId,
        JSON.stringify({ ...input, rate_id: newRateId }),
      ]);

      // 4. Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'ADMIN', 'MOBILE-DEVICE', 'RATE_TARIFF', ?, 'CREATE', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        input.created_by || 'ADMIN',
        newRateId,
        JSON.stringify(input),
        now,
      ]);
    });

    const created = await this.getActiveRate(input.project_id);
    return created!;
  }
}
