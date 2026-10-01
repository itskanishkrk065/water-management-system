import { getDatabase } from '../db/database';
import { Extension, ExtensionStatus } from '../types/domain';
import { WaterRepository } from './WaterRepository';

const waterRepo = new WaterRepository();

export interface CreateExtensionRequestInput {
  beneficiary_id: string;
  original_allotment_id: string;
  requested_additional_area: number;
  requested_additional_litres: number;
  remarks?: string;
  created_by?: string;
}

export class ExtensionRepository {
  /**
   * Get all extensions with optional status filter
   */
  async getAll(statusFilter?: ExtensionStatus): Promise<Extension[]> {
    const db = await getDatabase();
    let sql = `
      SELECT e.*, b.name as beneficiary_name 
      FROM extensions e
      JOIN beneficiaries b ON e.beneficiary_id = b.beneficiary_id
    `;
    const params: any[] = [];

    if (statusFilter) {
      sql += ' WHERE e.status = ?';
      params.push(statusFilter);
    }

    sql += ' ORDER BY e.created_at DESC;';
    return await db.getAllAsync<Extension>(sql, params);
  }

  /**
   * Get all extensions for a specific beneficiary
   */
  async getByBeneficiaryId(beneficiaryId: string): Promise<Extension[]> {
    const db = await getDatabase();
    const sql = `
      SELECT e.*, b.name as beneficiary_name 
      FROM extensions e
      JOIN beneficiaries b ON e.beneficiary_id = b.beneficiary_id
      WHERE e.beneficiary_id = ?
      ORDER BY e.created_at DESC;
    `;
    return await db.getAllAsync<Extension>(sql, [beneficiaryId]);
  }

  /**
   * Get single extension by ID
   */
  async getById(extensionId: string): Promise<Extension | null> {
    const db = await getDatabase();
    const sql = `
      SELECT e.*, b.name as beneficiary_name 
      FROM extensions e
      JOIN beneficiaries b ON e.beneficiary_id = b.beneficiary_id
      WHERE e.extension_id = ?;
    `;
    return await db.getFirstAsync<Extension>(sql, [extensionId]);
  }

  /**
   * Create an extension request
   */
  async createRequest(input: CreateExtensionRequestInput): Promise<Extension> {
    const db = await getDatabase();
    const extId = `ext-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        INSERT INTO extensions (
          extension_id, beneficiary_id, original_allotment_id, requested_additional_area, requested_additional_litres,
          status, requested_at, remarks, sync_status, local_version, server_version, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?, ?, 'PENDING_SYNC', 1, 0, ?, ?, ?);
      `, [
        extId,
        input.beneficiary_id,
        input.original_allotment_id,
        input.requested_additional_area,
        input.requested_additional_litres,
        now,
        input.remarks || null,
        input.created_by || 'FIELD_OFFICER',
        now,
        now,
      ]);

      // Record in sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'EXTENSION', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-ext-create-${extId}`,
        extId,
        JSON.stringify({ ...input, extension_id: extId }),
      ]);

      // Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'FIELD_OFFICER', 'MOBILE-DEVICE', 'EXTENSION', ?, 'CREATE', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        input.created_by || 'FIELD_OFFICER',
        extId,
        JSON.stringify({
          requested_area: input.requested_additional_area,
          requested_litres: input.requested_additional_litres,
        }),
        now,
      ]);
    });

    const created = await this.getById(extId);
    return created!;
  }

  /**
   * Approve extension request (Admin action: calculates extension development cost = approved_litres * dev_rate)
   */
  async approveExtension(
    extensionId: string,
    approvedArea: number,
    approvedLitres: number,
    projectId: string = 'prj-csii',
    approvedBy: string = 'ADMIN',
    remarks?: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const tariff = await waterRepo.getActiveTariff(projectId);
    const devRate = tariff?.development_cost_per_litre || 12.50;
    const rateId = tariff?.rate_id || 'rate-2026-v1';

    // Extension Cost = approved_additional_litres * additional_development_cost_per_litre
    const extensionCost = Math.round(approvedLitres * devRate * 100) / 100;

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        UPDATE extensions 
        SET status = 'APPROVED',
            approved_additional_area = ?,
            approved_additional_litres = ?,
            rate_id = ?,
            additional_development_cost_per_litre = ?,
            extension_cost = ?,
            approved_by = ?,
            approved_at = ?,
            remarks = COALESCE(?, remarks),
            sync_status = 'PENDING_SYNC',
            local_version = local_version + 1,
            updated_by = ?,
            updated_at = ?
        WHERE extension_id = ?;
      `, [
        approvedArea,
        approvedLitres,
        rateId,
        devRate,
        extensionCost,
        approvedBy,
        now,
        remarks || null,
        approvedBy,
        now,
        extensionId,
      ]);

      // Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, new_values_json, timestamp)
        VALUES (?, ?, 'ADMIN', 'MOBILE-DEVICE', 'EXTENSION', ?, 'EXTENSION_APPROVED', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        approvedBy,
        extensionId,
        JSON.stringify({ approved_litres: approvedLitres, extension_cost: extensionCost }),
        now,
      ]);
    });
  }

  /**
   * Reject or cancel extension
   */
  async updateStatus(
    extensionId: string,
    status: ExtensionStatus,
    reason?: string,
    user: string = 'ADMIN'
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(`
      UPDATE extensions 
      SET status = ?,
          remarks = COALESCE(?, remarks),
          sync_status = 'PENDING_SYNC',
          local_version = local_version + 1,
          updated_by = ?,
          updated_at = ?
      WHERE extension_id = ?;
    `, [status, reason || null, user, now, extensionId]);
  }
}
