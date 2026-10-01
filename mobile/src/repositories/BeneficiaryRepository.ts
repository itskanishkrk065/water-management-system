import { getDatabase } from '../db/database';
import { Beneficiary, LandHolding, SurveyParcel } from '../types/domain';
import { SyncStatus } from '../types/sync';

export interface CreateBeneficiaryInput {
  name: string;
  phone_number: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  address_line3?: string;
  district_id: string;
  block_id: string;
  village_id: string;
  pincode: string;
  location_direction?: string;
  location_description?: string;
  total_land_acres: number;
  created_by?: string;
}

export class BeneficiaryRepository {
  /**
   * Search beneficiaries locally by name, phone, survey number, or application ID
   */
  async search(query: string): Promise<Beneficiary[]> {
    const db = await getDatabase();
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return this.getAll();
    }

    const sql = `
      SELECT DISTINCT b.*, 
             d.name as district_name,
             blk.name as block_name,
             v.name as village_name,
             (SELECT COUNT(*) FROM land_holdings lh WHERE lh.beneficiary_id = b.beneficiary_id AND lh.status != 'ARCHIVED') as holdings_count,
             (SELECT COUNT(*) FROM water_applications wa WHERE wa.beneficiary_id = b.beneficiary_id) as applications_count
      FROM beneficiaries b
      LEFT JOIN districts d ON b.district_id = d.district_id
      LEFT JOIN blocks blk ON b.block_id = blk.block_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      LEFT JOIN land_holdings lh ON b.beneficiary_id = lh.beneficiary_id
      LEFT JOIN survey_parcels sp ON lh.holding_id = sp.holding_id
      LEFT JOIN water_applications wa ON b.beneficiary_id = wa.beneficiary_id
      WHERE b.name LIKE ? 
         OR b.phone_number LIKE ? 
         OR sp.survey_number LIKE ?
         OR sp.subdivision_number LIKE ?
         OR wa.application_id LIKE ?
      ORDER BY b.created_at DESC;
    `;

    const searchPattern = `%${cleanQuery}%`;
    const rows = await db.getAllAsync<Beneficiary>(sql, [
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
    ]);

    return rows;
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
             v.name as village_name,
             (SELECT COUNT(*) FROM land_holdings lh WHERE lh.beneficiary_id = b.beneficiary_id AND lh.status != 'ARCHIVED') as holdings_count,
             (SELECT COUNT(*) FROM water_applications wa WHERE wa.beneficiary_id = b.beneficiary_id) as applications_count,
             (SELECT COUNT(*) FROM water_allotments alt WHERE alt.beneficiary_id = b.beneficiary_id AND alt.status = 'ACTIVE') as allotments_count
      FROM beneficiaries b
      LEFT JOIN districts d ON b.district_id = d.district_id
      LEFT JOIN blocks blk ON b.block_id = blk.block_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      WHERE b.status != 'ARCHIVED'
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
             v.name as village_name
      FROM beneficiaries b
      LEFT JOIN districts d ON b.district_id = d.district_id
      LEFT JOIN blocks blk ON b.block_id = blk.block_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      WHERE b.phone_number = ?
      LIMIT 1;
    `;
    const row = await db.getFirstAsync<Beneficiary>(sql, [phone]);
    return row || null;
  }

  /**
   * Get full beneficiary profile including land holdings and parcels
   */
  async getById(beneficiaryId: string): Promise<Beneficiary | null> {
    const db = await getDatabase();
    const benSql = `
      SELECT b.*, 
             d.name as district_name,
             blk.name as block_name,
             v.name as village_name,
             (SELECT COUNT(*) FROM land_holdings lh WHERE lh.beneficiary_id = b.beneficiary_id AND lh.status != 'ARCHIVED') as holdings_count,
             (SELECT COUNT(*) FROM water_applications wa WHERE wa.beneficiary_id = b.beneficiary_id) as applications_count
      FROM beneficiaries b
      LEFT JOIN districts d ON b.district_id = d.district_id
      LEFT JOIN blocks blk ON b.block_id = blk.block_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      WHERE b.beneficiary_id = ?;
    `;
    const beneficiary = await db.getFirstAsync<Beneficiary>(benSql, [beneficiaryId]);
    if (!beneficiary) return null;

    // Fetch holdings
    const holdingsSql = `
      SELECT lh.*,
             CASE WHEN EXISTS (
               SELECT 1 FROM water_allotments alt 
               WHERE alt.holding_id = lh.holding_id AND alt.status = 'ACTIVE'
             ) THEN 1 ELSE 0 END as has_active_allotment
      FROM land_holdings lh
      WHERE lh.beneficiary_id = ? AND lh.status != 'ARCHIVED'
      ORDER BY lh.created_at ASC;
    `;
    const rawHoldings = await db.getAllAsync<any>(holdingsSql, [beneficiaryId]);
    const holdings: LandHolding[] = [];

    // Fetch parcels for each holding
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
    return beneficiary;
  }

  /**
   * Create a new Beneficiary with initial local sync status
   */
  async create(input: CreateBeneficiaryInput, id?: string): Promise<Beneficiary> {
    const db = await getDatabase();
    const beneficiaryId = id || `ben-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO beneficiaries (
        beneficiary_id, name, phone_number, email,
        address_line1, address_line2, address_line3,
        district_id, block_id, village_id, pincode,
        location_direction, location_description,
        status, total_land_acres, sync_status,
        local_version, server_version, created_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 'PENDING_SYNC', 1, 0, ?, ?, ?);
    `;

    await db.runAsync(sql, [
      beneficiaryId,
      input.name,
      input.phone_number,
      input.email || null,
      input.address_line1 || null,
      input.address_line2 || null,
      input.address_line3 || null,
      input.district_id,
      input.block_id,
      input.village_id,
      input.pincode,
      input.location_direction || null,
      input.location_description || null,
      input.total_land_acres,
      input.created_by || 'FIELD_OFFICER',
      now,
      now,
    ]);

    // Record in sync queue
    await db.runAsync(`
      INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
      VALUES (?, ?, 'BENEFICIARY', ?, 'CREATE', ?, 'PENDING');
    `, [
      `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      `op-ben-create-${beneficiaryId}`,
      beneficiaryId,
      JSON.stringify({ ...input, beneficiary_id: beneficiaryId }),
    ]);

    // Record in local audit
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

    const created = await this.getById(beneficiaryId);
    return created!;
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(beneficiaryId: string, status: SyncStatus): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE beneficiaries SET sync_status = ?, last_synced_at = datetime("now") WHERE beneficiary_id = ?;',
      [status, beneficiaryId]
    );
  }
}
