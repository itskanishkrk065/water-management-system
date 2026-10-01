import { getDatabase } from '../db/database';
import { ProjectScheme } from '../types/domain';

export interface CreateProjectInput {
  project_code: string;
  project_name: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  start_date?: string;
  end_date?: string;
  created_by?: string;
}

export interface UpdateProjectInput {
  project_id: string;
  project_name?: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  start_date?: string;
  end_date?: string;
  updated_by?: string;
}

export class ProjectRepository {
  async getAll(): Promise<(ProjectScheme & { holdings_count?: number; apps_count?: number })[]> {
    const db = await getDatabase();
    const sql = `
      SELECT ps.*,
             (SELECT COUNT(*) FROM land_holdings lh WHERE lh.project_id = ps.project_id AND lh.status != 'ARCHIVED') as holdings_count,
             (SELECT COUNT(*) FROM water_applications wa WHERE wa.project_id = ps.project_id) as apps_count
      FROM project_schemes ps
      ORDER BY ps.created_at DESC;
    `;
    return db.getAllAsync<any>(sql);
  }

  async getActive(): Promise<ProjectScheme[]> {
    const db = await getDatabase();
    return db.getAllAsync<ProjectScheme>(
      'SELECT * FROM project_schemes WHERE status = "ACTIVE" ORDER BY project_name ASC;'
    );
  }

  async getById(id: string): Promise<ProjectScheme | null> {
    const db = await getDatabase();
    const item = await db.getFirstAsync<ProjectScheme>(
      'SELECT * FROM project_schemes WHERE project_id = ?;',
      [id]
    );
    return item || null;
  }

  async create(input: CreateProjectInput): Promise<ProjectScheme> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const projectId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        INSERT INTO project_schemes (
          project_id, project_code, project_name, description, status,
          start_date, end_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        projectId,
        input.project_code.trim().toUpperCase(),
        input.project_name.trim(),
        input.description || null,
        input.status || 'ACTIVE',
        input.start_date || null,
        input.end_date || null,
        now,
        now,
      ]);

      // Seed default active rate tariff for the project
      const rateId = `rate-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await db.runAsync(`
        INSERT INTO rate_tariffs (
          rate_id, project_id, litres_per_acre,
          development_cost_per_litre, running_cost_per_litre,
          effective_from, effective_to, is_active,
          created_at, updated_at
        ) VALUES (?, ?, 5000, 15.00, 1.50, ?, NULL, 1, ?, ?);
      `, [rateId, projectId, now, now, now]);

      // Queue sync
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'PROJECT_SCHEME', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-proj-create-${projectId}`,
        projectId,
        JSON.stringify({ ...input, project_id: projectId }),
      ]);

      // Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'ADMIN', 'MOBILE-DEVICE', 'PROJECT_SCHEME', ?, 'CREATE', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        input.created_by || 'ADMIN',
        projectId,
        JSON.stringify(input),
        now,
      ]);
    });

    const created = await this.getById(projectId);
    return created!;
  }

  async update(input: UpdateProjectInput): Promise<ProjectScheme> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        UPDATE project_schemes
        SET project_name = COALESCE(?, project_name),
            description = COALESCE(?, description),
            status = COALESCE(?, status),
            start_date = COALESCE(?, start_date),
            end_date = COALESCE(?, end_date),
            updated_at = ?
        WHERE project_id = ?;
      `, [
        input.project_name || null,
        input.description || null,
        input.status || null,
        input.start_date || null,
        input.end_date || null,
        now,
        input.project_id,
      ]);

      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'PROJECT_SCHEME', ?, 'UPDATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-proj-update-${input.project_id}-${Date.now()}`,
        input.project_id,
        JSON.stringify(input),
      ]);
    });

    const updated = await this.getById(input.project_id);
    return updated!;
  }

  async toggleStatus(id: string, updatedBy?: string): Promise<ProjectScheme> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Project scheme not found');
    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.update({
      project_id: id,
      status: newStatus,
      updated_by: updatedBy,
    });
  }
}
