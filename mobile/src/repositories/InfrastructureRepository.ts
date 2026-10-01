import { getDatabase } from '../db/database';
import { Infrastructure, InfrastructureStatus } from '../types/domain';

export interface CreateInfrastructureInput {
  allotment_id: string;
  beneficiary_id: string;
  planned_date?: string;
  remarks?: string;
  created_by?: string;
}

export class InfrastructureRepository {
  /**
   * Get all infrastructure records with optional status filter
   */
  async getAll(statusFilter?: InfrastructureStatus): Promise<Infrastructure[]> {
    const db = await getDatabase();
    let sql = `
      SELECT i.*, b.name as beneficiary_name 
      FROM infrastructure i
      JOIN beneficiaries b ON i.beneficiary_id = b.beneficiary_id
    `;
    const params: any[] = [];

    if (statusFilter) {
      sql += ' WHERE i.status = ?';
      params.push(statusFilter);
    }

    sql += ' ORDER BY i.created_at DESC;';
    return await db.getAllAsync<Infrastructure>(sql, params);
  }

  /**
   * Get infrastructure record for a specific beneficiary
   */
  async getByBeneficiaryId(beneficiaryId: string): Promise<Infrastructure[]> {
    const db = await getDatabase();
    const sql = `
      SELECT i.*, b.name as beneficiary_name 
      FROM infrastructure i
      JOIN beneficiaries b ON i.beneficiary_id = b.beneficiary_id
      WHERE i.beneficiary_id = ?
      ORDER BY i.created_at DESC;
    `;
    return await db.getAllAsync<Infrastructure>(sql, [beneficiaryId]);
  }

  /**
   * Get single infrastructure record by ID
   */
  async getById(infrastructureId: string): Promise<Infrastructure | null> {
    const db = await getDatabase();
    const sql = `
      SELECT i.*, b.name as beneficiary_name 
      FROM infrastructure i
      JOIN beneficiaries b ON i.beneficiary_id = b.beneficiary_id
      WHERE i.infrastructure_id = ?;
    `;
    return await db.getFirstAsync<Infrastructure>(sql, [infrastructureId]);
  }

  /**
   * Create an infrastructure record for a newly approved water allotment
   */
  async create(input: CreateInfrastructureInput): Promise<Infrastructure> {
    const db = await getDatabase();
    const infraId = `infra-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        INSERT INTO infrastructure (
          infrastructure_id, allotment_id, beneficiary_id, status,
          planned_date, remarks, sync_status, local_version, server_version, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, 'PLANNED', ?, ?, 'PENDING_SYNC', 1, 0, ?, ?, ?);
      `, [
        infraId,
        input.allotment_id,
        input.beneficiary_id,
        input.planned_date || now.split('T')[0],
        input.remarks || null,
        input.created_by || 'ADMIN',
        now,
        now,
      ]);

      // Record in sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'INFRASTRUCTURE', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-infra-create-${infraId}`,
        infraId,
        JSON.stringify({ ...input, infrastructure_id: infraId }),
      ]);

      // Record Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'ADMIN', 'MOBILE-DEVICE', 'INFRASTRUCTURE', ?, 'CREATE', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        input.created_by || 'ADMIN',
        infraId,
        JSON.stringify({ allotment_id: input.allotment_id, status: 'PLANNED' }),
        now,
      ]);
    });

    const created = await this.getById(infraId);
    return created!;
  }

  /**
   * Update infrastructure status (e.g. COMMISSIONED, UNDER_CONSTRUCTION, COMPLETED)
   */
  async updateStatus(
    infrastructureId: string,
    newStatus: InfrastructureStatus,
    dates: {
      construction_start_date?: string;
      completion_date?: string;
      commissioned_date?: string;
    },
    remarks?: string,
    updatedBy: string = 'ADMIN'
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const existing = await this.getById(infrastructureId);
    if (!existing) throw new Error('Infrastructure record not found');

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        UPDATE infrastructure 
        SET status = ?,
            construction_start_date = COALESCE(?, construction_start_date),
            completion_date = COALESCE(?, completion_date),
            commissioned_date = COALESCE(?, commissioned_date),
            remarks = COALESCE(?, remarks),
            sync_status = 'PENDING_SYNC',
            local_version = local_version + 1,
            updated_by = ?,
            updated_at = ?
        WHERE infrastructure_id = ?;
      `, [
        newStatus,
        dates.construction_start_date || null,
        dates.completion_date || null,
        dates.commissioned_date || (newStatus === 'COMMISSIONED' ? now.split('T')[0] : null),
        remarks || null,
        updatedBy,
        now,
        infrastructureId,
      ]);

      // Record in sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'INFRASTRUCTURE', ?, 'UPDATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-infra-update-${infrastructureId}-${Date.now()}`,
        infrastructureId,
        JSON.stringify({ status: newStatus, dates, remarks }),
      ]);

      // Record Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, old_values_json, new_values_json, timestamp)
        VALUES (?, ?, 'ADMIN', 'MOBILE-DEVICE', 'INFRASTRUCTURE', ?, 'INFRASTRUCTURE_STATUS_CHANGED', ?, ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        updatedBy,
        infrastructureId,
        JSON.stringify({ status: existing.status }),
        JSON.stringify({ status: newStatus, remarks, dates }),
        now,
      ]);
    });
  }

  /**
   * Fast-track commissioning of an infrastructure line
   */
  async commissionLine(infrastructureId: string, commissionedBy: string = 'ADMIN', date?: string, notes?: string): Promise<void> {
    const commDate = date || new Date().toISOString().split('T')[0];
    return this.updateStatus(
      infrastructureId,
      'COMMISSIONED',
      { commissioned_date: commDate, completion_date: commDate },
      notes || 'Pipeline commissioned and water release certified',
      commissionedBy
    );
  }
}
