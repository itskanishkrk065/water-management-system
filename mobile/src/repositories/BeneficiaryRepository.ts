import { getDatabase } from '../db/database';
import {
  Beneficiary,
  LandHolding,
  SurveyParcel,
  WaterApplication,
  WaterAllotment,
  DevelopmentBill,
  RunningBill,
  Infrastructure,
  Extension,
  Payment,
  BeneficiaryDocument,
} from '../types/domain';
import { SyncStatus } from '../types/sync';

export interface CreateBeneficiaryInput {
  name: string;
  phone_number: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  district_id?: string;
  block_id?: string;
  panchayat_id?: string;
  village_id?: string;
  pincode?: string;
  location_direction?: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
  location_description?: string;
  total_land_acres: number;
  created_by?: string;
}

export interface UpdateBeneficiaryInput extends Partial<CreateBeneficiaryInput> {
  beneficiary_id: string;
  status?: 'ACTIVE' | 'INACTIVE';
  updated_by?: string;
}

export class BeneficiaryRepository {
  /**
   * Search beneficiaries locally by name, phone, survey number, subdivision, or village
   */
  async search(query: string, villageId?: string): Promise<Beneficiary[]> {
    const db = await getDatabase();
    const cleanQuery = query.trim();

    let sql = `
      SELECT DISTINCT b.*, 
             d.name as district_name,
             blk.name as block_name,
             p.name as panchayat_name,
             v.name as village_name,
             (SELECT COUNT(*) FROM land_holdings lh WHERE lh.beneficiary_id = b.beneficiary_id AND lh.status != 'ARCHIVED') as holdings_count,
             (SELECT COUNT(*) FROM water_applications wa WHERE wa.beneficiary_id = b.beneficiary_id) as applications_count,
             (SELECT COUNT(*) FROM water_allotments alt WHERE alt.beneficiary_id = b.beneficiary_id AND alt.is_active = 1) as allotments_count
      FROM beneficiaries b
      LEFT JOIN districts d ON b.district_id = d.district_id
      LEFT JOIN blocks blk ON b.block_id = blk.block_id
      LEFT JOIN panchayats p ON b.panchayat_id = p.panchayat_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      LEFT JOIN land_holdings lh ON b.beneficiary_id = lh.beneficiary_id
      LEFT JOIN survey_parcels sp ON lh.holding_id = sp.holding_id
      LEFT JOIN water_applications wa ON b.beneficiary_id = wa.beneficiary_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (villageId) {
      sql += ' AND b.village_id = ?';
      params.push(villageId);
    }

    if (cleanQuery) {
      const searchPattern = `%${cleanQuery}%`;
      sql += ` AND (
        b.name LIKE ? 
        OR b.phone_number LIKE ? 
        OR sp.survey_number LIKE ?
        OR sp.subdivision_number LIKE ?
        OR wa.application_id LIKE ?
      )`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    sql += ' ORDER BY b.created_at DESC;';
    return await db.getAllAsync<Beneficiary>(sql, params);
  }

  /**
   * Get all active beneficiaries with location names
   */
  async getAll(): Promise<Beneficiary[]> {
    const db = await getDatabase();
    const sql = `
      SELECT b.*, 
             d.name as district_name,
             blk.name as block_name,
             p.name as panchayat_name,
             v.name as village_name,
             (SELECT COUNT(*) FROM land_holdings lh WHERE lh.beneficiary_id = b.beneficiary_id AND lh.status != 'ARCHIVED') as holdings_count,
             (SELECT COUNT(*) FROM water_applications wa WHERE wa.beneficiary_id = b.beneficiary_id) as applications_count,
             (SELECT COUNT(*) FROM water_allotments alt WHERE alt.beneficiary_id = b.beneficiary_id AND alt.is_active = 1) as allotments_count
      FROM beneficiaries b
      LEFT JOIN districts d ON b.district_id = d.district_id
      LEFT JOIN blocks blk ON b.block_id = blk.block_id
      LEFT JOIN panchayats p ON b.panchayat_id = p.panchayat_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      WHERE b.status = 'ACTIVE'
      ORDER BY b.created_at DESC;
    `;
    return await db.getAllAsync<Beneficiary>(sql);
  }

  /**
   * Find a beneficiary by Phone number
   */
  async findByPhone(phone: string): Promise<Beneficiary | null> {
    const db = await getDatabase();
    const sql = `
      SELECT b.*, 
             d.name as district_name,
             blk.name as block_name,
             p.name as panchayat_name,
             v.name as village_name
      FROM beneficiaries b
      LEFT JOIN districts d ON b.district_id = d.district_id
      LEFT JOIN blocks blk ON b.block_id = blk.block_id
      LEFT JOIN panchayats p ON b.panchayat_id = p.panchayat_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      WHERE b.phone_number = ?
      LIMIT 1;
    `;
    const row = await db.getFirstAsync<Beneficiary>(sql, [phone]);
    return row || null;
  }

  /**
   * Get full beneficiary dossier including land, parcels, water, bills, running bills, infrastructure, extensions, payments, and documents
   */
  async getById(beneficiaryId: string): Promise<Beneficiary | null> {
    const db = await getDatabase();
    const benSql = `
      SELECT b.*, 
             d.name as district_name,
             blk.name as block_name,
             p.name as panchayat_name,
             v.name as village_name,
             (SELECT COUNT(*) FROM land_holdings lh WHERE lh.beneficiary_id = b.beneficiary_id AND lh.status != 'ARCHIVED') as holdings_count,
             (SELECT COUNT(*) FROM water_applications wa WHERE wa.beneficiary_id = b.beneficiary_id) as applications_count,
             (SELECT COUNT(*) FROM water_allotments alt WHERE alt.beneficiary_id = b.beneficiary_id AND alt.is_active = 1) as allotments_count
      FROM beneficiaries b
      LEFT JOIN districts d ON b.district_id = d.district_id
      LEFT JOIN blocks blk ON b.block_id = blk.block_id
      LEFT JOIN panchayats p ON b.panchayat_id = p.panchayat_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      WHERE b.beneficiary_id = ?;
    `;
    const beneficiary = await db.getFirstAsync<Beneficiary>(benSql, [beneficiaryId]);
    if (!beneficiary) return null;

    // 1. Fetch Land Holdings with Parcels
    const holdingsSql = `
      SELECT lh.*, ps.project_name,
             CASE WHEN EXISTS (
               SELECT 1 FROM water_allotments alt 
               WHERE alt.holding_id = lh.holding_id AND alt.is_active = 1
             ) THEN 1 ELSE 0 END as has_active_allotment
      FROM land_holdings lh
      LEFT JOIN project_schemes ps ON lh.project_id = ps.project_id
      WHERE lh.beneficiary_id = ? AND lh.status != 'ARCHIVED'
      ORDER BY lh.created_at ASC;
    `;
    const rawHoldings = await db.getAllAsync<any>(holdingsSql, [beneficiaryId]);
    const holdings: LandHolding[] = [];

    for (const h of rawHoldings) {
      const parcelsSql = `
        SELECT * FROM survey_parcels 
        WHERE holding_id = ? AND status != 'ARCHIVED'
        ORDER BY survey_number ASC, subdivision_number ASC;
      `;
      const parcels = await db.getAllAsync<SurveyParcel>(parcelsSql, [h.holding_id]);
      holdings.push({
        ...h,
        has_active_allotment: Boolean(h.has_active_allotment),
        parcels,
      });
    }
    beneficiary.land_holdings = holdings;

    // 2. Fetch Water Applications with Allotments
    const appsSql = `
      SELECT wa.*, 
             b.name as beneficiary_name, 
             b.phone_number as beneficiary_phone,
             v.name as village_name
      FROM water_applications wa
      JOIN beneficiaries b ON wa.beneficiary_id = b.beneficiary_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      WHERE wa.beneficiary_id = ?
      ORDER BY wa.created_at DESC;
    `;
    const apps = await db.getAllAsync<WaterApplication>(appsSql, [beneficiaryId]);
    for (const app of apps) {
      const allotment = await db.getFirstAsync<WaterAllotment>(
        'SELECT * FROM water_allotments WHERE application_id = ?;',
        [app.application_id]
      );
      app.allotment = allotment || null;
    }
    beneficiary.water_applications = apps;

    // 3. Fetch Development Bills with 5-stage Installments
    const bills = await db.getAllAsync<DevelopmentBill>(
      'SELECT * FROM development_bills WHERE beneficiary_id = ? ORDER BY created_at DESC;',
      [beneficiaryId]
    );
    for (const bill of bills) {
      bill.installments = await db.getAllAsync<any>(
        'SELECT * FROM installments WHERE bill_id = ? ORDER BY installment_number ASC;',
        [bill.bill_id]
      );
    }
    beneficiary.development_bills = bills;

    // 4. Fetch Running Bills
    beneficiary.running_bills = await db.getAllAsync<RunningBill>(
      'SELECT * FROM running_bills WHERE beneficiary_id = ? ORDER BY created_at DESC;',
      [beneficiaryId]
    );

    // 5. Fetch Infrastructure Records
    beneficiary.infrastructures = await db.getAllAsync<Infrastructure>(
      'SELECT * FROM infrastructure WHERE beneficiary_id = ? ORDER BY created_at DESC;',
      [beneficiaryId]
    );

    // 6. Fetch Extensions
    beneficiary.extensions = await db.getAllAsync<Extension>(
      'SELECT * FROM extensions WHERE beneficiary_id = ? ORDER BY created_at DESC;',
      [beneficiaryId]
    );

    // 7. Fetch Payments
    beneficiary.payments = await db.getAllAsync<Payment>(
      'SELECT * FROM payments WHERE beneficiary_id = ? ORDER BY payment_date DESC;',
      [beneficiaryId]
    );

    // 8. Fetch Documents
    beneficiary.documents = await db.getAllAsync<BeneficiaryDocument>(
      'SELECT * FROM beneficiary_documents WHERE beneficiary_id = ? ORDER BY created_at DESC;',
      [beneficiaryId]
    );

    return beneficiary;
  }

  /**
   * Create a new Beneficiary
   */
  async create(input: CreateBeneficiaryInput, id?: string): Promise<Beneficiary> {
    const db = await getDatabase();
    const beneficiaryId = id || `ben-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO beneficiaries (
        beneficiary_id, name, phone_number, email,
        address_line1, address_line2, address_line3,
        district_id, block_id, panchayat_id, village_id, pincode,
        location_direction, location_description,
        status, total_land_acres, sync_status,
        local_version, server_version, created_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 'PENDING_SYNC', 1, 0, ?, ?, ?);
    `;

    await db.withTransactionAsync(async () => {
      await db.runAsync(sql, [
        beneficiaryId,
        input.name,
        input.phone_number,
        input.email || null,
        input.address_line1 || null,
        input.address_line2 || null,
        input.address_line3 || null,
        input.district_id || null,
        input.block_id || null,
        input.panchayat_id || null,
        input.village_id || null,
        input.pincode || null,
        input.location_direction || null,
        input.location_description || null,
        input.total_land_acres,
        input.created_by || 'FIELD_OFFICER',
        now,
        now,
      ]);

      // Sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'BENEFICIARY', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-ben-create-${beneficiaryId}`,
        beneficiaryId,
        JSON.stringify({ ...input, beneficiary_id: beneficiaryId }),
      ]);

      // Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'FIELD_OFFICER', 'MOBILE-DEVICE', 'BENEFICIARY', ?, 'CREATE', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        input.created_by || 'FIELD_OFFICER',
        beneficiaryId,
        JSON.stringify({ name: input.name, phone: input.phone_number }),
        now,
      ]);
    });

    const created = await this.getById(beneficiaryId);
    return created!;
  }

  /**
   * Update beneficiary profile
   */
  async update(input: UpdateBeneficiaryInput): Promise<Beneficiary> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const existing = await this.getById(input.beneficiary_id);
    if (!existing) throw new Error('Beneficiary not found');

    const sql = `
      UPDATE beneficiaries 
      SET name = COALESCE(?, name),
          email = COALESCE(?, email),
          address_line1 = COALESCE(?, address_line1),
          address_line2 = COALESCE(?, address_line2),
          address_line3 = COALESCE(?, address_line3),
          district_id = COALESCE(?, district_id),
          block_id = COALESCE(?, block_id),
          panchayat_id = COALESCE(?, panchayat_id),
          village_id = COALESCE(?, village_id),
          pincode = COALESCE(?, pincode),
          location_direction = COALESCE(?, location_direction),
          location_description = COALESCE(?, location_description),
          status = COALESCE(?, status),
          sync_status = 'PENDING_SYNC',
          local_version = local_version + 1,
          updated_by = ?,
          updated_at = ?
      WHERE beneficiary_id = ?;
    `;

    await db.withTransactionAsync(async () => {
      await db.runAsync(sql, [
        input.name || null,
        input.email || null,
        input.address_line1 || null,
        input.address_line2 || null,
        input.address_line3 || null,
        input.district_id || null,
        input.block_id || null,
        input.panchayat_id || null,
        input.village_id || null,
        input.pincode || null,
        input.location_direction || null,
        input.location_description || null,
        input.status || null,
        input.updated_by || 'FIELD_OFFICER',
        now,
        input.beneficiary_id,
      ]);

      // Sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'BENEFICIARY', ?, 'UPDATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-ben-update-${input.beneficiary_id}-${Date.now()}`,
        input.beneficiary_id,
        JSON.stringify(input),
      ]);

      // Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, old_values_json, new_values_json, timestamp)
        VALUES (?, ?, 'FIELD_OFFICER', 'MOBILE-DEVICE', 'BENEFICIARY', ?, 'UPDATE', ?, ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        input.updated_by || 'FIELD_OFFICER',
        input.beneficiary_id,
        JSON.stringify({ name: existing.name, status: existing.status }),
        JSON.stringify(input),
        now,
      ]);
    });

    const updated = await this.getById(input.beneficiary_id);
    return updated!;
  }

  /**
   * Phone number lookup and duplicate check
   */
  async lookupByPhone(phone: string): Promise<Beneficiary | null> {
    const db = await getDatabase();
    const cleanPhone = phone.trim();
    const sql = `
      SELECT b.*, 
             d.name as district_name,
             p.name as panchayat_name,
             v.name as village_name
      FROM beneficiaries b
      LEFT JOIN districts d ON b.district_id = d.district_id
      LEFT JOIN panchayats p ON b.panchayat_id = p.panchayat_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      WHERE b.phone_number = ?
      LIMIT 1;
    `;
    const ben = await db.getFirstAsync<Beneficiary>(sql, [cleanPhone]);
    return ben || null;
  }

  /**
   * Evaluates outstanding obligations before administrative deactivation
   */
  async getObligationsSummary(id: string): Promise<{
    beneficiaryId: string;
    hasObligations: boolean;
    activeApplicationsCount: number;
    approvedAllotmentsCount: number;
    approvedWaterLitres: number;
    totalPendingAmount: number;
    pendingInstallmentsCount: number;
    activeInfrastructureCount: number;
    pendingExtensionsCount: number;
    warningMessage: string | null;
  }> {
    const db = await getDatabase();
    const ben = await this.getById(id);
    if (!ben) throw new Error('Beneficiary not found');

    const apps = ben.water_applications?.filter((a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW') || [];
    const allotments = ben.water_allotments?.filter((a) => a.is_active) || [];
    const approvedLitres = allotments.reduce((acc, a) => acc + (a.approved_litres || 0), 0);

    let pendingAmount = 0;
    let pendingInstallments = 0;
    ben.development_bills?.forEach((b) => {
      pendingAmount += b.pending_amount || 0;
      b.installments?.forEach((inst) => {
        if (inst.status !== 'PAID') pendingInstallments += 1;
      });
    });

    const infraCount = ben.infrastructure?.length || 0;
    const extensionsCount = ben.extensions?.filter((e) => e.status === 'REQUESTED').length || 0;

    const hasObligations =
      apps.length > 0 ||
      allotments.length > 0 ||
      pendingAmount > 0 ||
      pendingInstallments > 0 ||
      infraCount > 0 ||
      extensionsCount > 0;

    return {
      beneficiaryId: id,
      hasObligations,
      activeApplicationsCount: apps.length,
      approvedAllotmentsCount: allotments.length,
      approvedWaterLitres: approvedLitres,
      totalPendingAmount: pendingAmount,
      pendingInstallmentsCount: pendingInstallments,
      activeInfrastructureCount: infraCount,
      pendingExtensionsCount: extensionsCount,
      warningMessage: hasObligations
        ? `This beneficiary has active operational records: ${approvedLitres} L approved water, ₹${pendingAmount} pending balance, and ${pendingInstallments} pending installments. Please review before proceeding.`
        : null,
    };
  }

  /**
   * Deactivates a beneficiary profile with audit reason
   */
  async deactivate(id: string, reason: string, userId?: string): Promise<Beneficiary> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        UPDATE beneficiaries
        SET status = 'INACTIVE',
            sync_status = 'PENDING_SYNC',
            local_version = local_version + 1,
            updated_by = ?,
            updated_at = ?
        WHERE beneficiary_id = ?;
      `, [userId || 'OFFICER', now, id]);

      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'BENEFICIARY', ?, 'DEACTIVATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-ben-deact-${id}-${Date.now()}`,
        id,
        JSON.stringify({ beneficiary_id: id, status: 'INACTIVE', reason }),
      ]);

      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'OFFICER', 'MOBILE-DEVICE', 'BENEFICIARY', ?, 'DEACTIVATE', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId || 'OFFICER',
        id,
        JSON.stringify({ action: 'DEACTIVATE', reason }),
        now,
      ]);
    });

    const updated = await this.getById(id);
    return updated!;
  }

  /**
   * Reactivates an inactive beneficiary profile with audit reason
   */
  async reactivate(id: string, reason: string, userId?: string): Promise<Beneficiary> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        UPDATE beneficiaries
        SET status = 'ACTIVE',
            sync_status = 'PENDING_SYNC',
            local_version = local_version + 1,
            updated_by = ?,
            updated_at = ?
        WHERE beneficiary_id = ?;
      `, [userId || 'OFFICER', now, id]);

      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'BENEFICIARY', ?, 'REACTIVATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-ben-react-${id}-${Date.now()}`,
        id,
        JSON.stringify({ beneficiary_id: id, status: 'ACTIVE', reason }),
      ]);

      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'OFFICER', 'MOBILE-DEVICE', 'BENEFICIARY', ?, 'REACTIVATE', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId || 'OFFICER',
        id,
        JSON.stringify({ action: 'REACTIVATE', reason }),
        now,
      ]);
    });

    const updated = await this.getById(id);
    return updated!;
  }
}
