import { getDatabase } from '../db/database';
import { LandHolding, SurveyParcel } from '../types/domain';

export interface CreateParcelInput {
  survey_number: string;
  subdivision_number: string;
  area: number;
}

export interface CreateHoldingInput {
  beneficiary_id: string;
  project_id: string;
  declared_total_area: number;
  area_unit?: string;
  parcels: CreateParcelInput[];
  created_by?: string;
}

export class LandRepository {
  /**
   * Check if a composite (survey_number + subdivision_number) already exists for a holding or draft
   */
  async checkCompositeDuplicate(
    holdingId: string,
    surveyNumber: string,
    subdivisionNumber: string,
    excludeParcelId?: string
  ): Promise<boolean> {
    const db = await getDatabase();
    const cleanSurvey = surveyNumber.trim().toUpperCase();
    const cleanSubdiv = subdivisionNumber.trim().toUpperCase();

    let sql = `
      SELECT COUNT(*) as count 
      FROM survey_parcels 
      WHERE holding_id = ? 
        AND UPPER(TRIM(survey_number)) = ? 
        AND UPPER(TRIM(subdivision_number)) = ?
        AND status != 'ARCHIVED'
    `;
    const params: any[] = [holdingId, cleanSurvey, cleanSubdiv];

    if (excludeParcelId) {
      sql += ' AND parcel_id != ?';
      params.push(excludeParcelId);
    }

    const res = await db.getFirstAsync<{ count: number }>(sql, params);
    return (res?.count ?? 0) > 0;
  }

  /**
   * Get all holdings for a beneficiary
   */
  async getByBeneficiaryId(beneficiaryId: string): Promise<LandHolding[]> {
    const db = await getDatabase();
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

    return holdings;
  }

  /**
   * Get eligible holdings for water application (Must NOT have active water allotment)
   */
  async getEligibleHoldings(beneficiaryId: string): Promise<LandHolding[]> {
    const holdings = await this.getByBeneficiaryId(beneficiaryId);
    return holdings.filter((h) => !h.has_active_allotment && h.status === 'ACTIVE');
  }

  /**
   * Create a Land Holding with its Survey/Subdivision Parcels in a single transaction
   */
  async createHolding(input: CreateHoldingInput): Promise<LandHolding> {
    const db = await getDatabase();
    const holdingId = `hld-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    // Verify parcel composite uniqueness within the input payload
    const seenCombos = new Set<string>();
    for (const p of input.parcels) {
      const combo = `${p.survey_number.trim().toUpperCase()}_${p.subdivision_number.trim().toUpperCase()}`;
      if (seenCombos.has(combo)) {
        throw new Error(`Duplicate parcel in input: Survey ${p.survey_number}, Subdivision ${p.subdivision_number}`);
      }
      seenCombos.add(combo);
    }

    // Verify parcel area total matches declared holding area
    const parcelTotalArea = input.parcels.reduce((sum, p) => sum + Number(p.area), 0);
    const roundedParcelTotal = Math.round(parcelTotalArea * 1000) / 1000;
    const roundedDeclared = Math.round(Number(input.declared_total_area) * 1000) / 1000;

    if (Math.abs(roundedParcelTotal - roundedDeclared) > 0.001) {
      throw new Error(
        `Declared area (${roundedDeclared} acres) does not match sum of parcels (${roundedParcelTotal} acres)`
      );
    }

    await db.withTransactionAsync(async () => {
      // 1. Insert Holding
      await db.runAsync(`
        INSERT INTO land_holdings (
          holding_id, beneficiary_id, project_id, declared_total_area, area_unit, status, is_locked, sync_status, local_version, server_version, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, 'PENDING_SYNC', 1, 0, ?, ?, ?);
      `, [
        holdingId,
        input.beneficiary_id,
        input.project_id,
        input.declared_total_area,
        input.area_unit || 'acres',
        input.created_by || 'FIELD_OFFICER',
        now,
        now,
      ]);

      // 2. Insert Parcels
      for (const p of input.parcels) {
        const parcelId = `pcl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await db.runAsync(`
          INSERT INTO survey_parcels (
            parcel_id, holding_id, survey_number, subdivision_number, area, status, sync_status, local_version, server_version, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'PENDING_SYNC', 1, 0, ?, ?, ?);
        `, [
          parcelId,
          holdingId,
          p.survey_number.trim(),
          p.subdivision_number.trim(),
          p.area,
          input.created_by || 'FIELD_OFFICER',
          now,
          now,
        ]);
      }

      // 3. Update total land acres on Beneficiary
      await db.runAsync(`
        UPDATE beneficiaries 
        SET total_land_acres = (
          SELECT COALESCE(SUM(declared_total_area), 0) 
          FROM land_holdings 
          WHERE beneficiary_id = ? AND status = 'ACTIVE'
        ),
        updated_at = ?
        WHERE beneficiary_id = ?;
      `, [input.beneficiary_id, now, input.beneficiary_id]);

      // 4. Record in sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'LAND_HOLDING', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-hld-create-${holdingId}`,
        holdingId,
        JSON.stringify({ ...input, holding_id: holdingId }),
      ]);

      // 5. Record Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'FIELD_OFFICER', 'MOBILE-DEVICE', 'LAND_HOLDING', ?, 'CREATE', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        input.created_by || 'FIELD_OFFICER',
        holdingId,
        JSON.stringify({ area: input.declared_total_area, parcels_count: input.parcels.length }),
        now,
      ]);
    });

    const created = await this.getHoldingById(holdingId);
    return created!;
  }

  /**
   * Get single holding with parcels
   */
  async getHoldingById(holdingId: string): Promise<LandHolding | null> {
    const db = await getDatabase();
    const holding = await db.getFirstAsync<LandHolding>(
      'SELECT * FROM land_holdings WHERE holding_id = ?;',
      [holdingId]
    );
    if (!holding) return null;

    const parcels = await db.getAllAsync<SurveyParcel>(
      'SELECT * FROM survey_parcels WHERE holding_id = ? AND status != "ARCHIVED";',
      [holdingId]
    );
    holding.parcels = parcels;
    return holding;
  }

  /**
   * Check if survey + subdivision combination is already registered across ANY active land holding
   */
  async checkGlobalParcelDuplicate(
    surveyNumber: string,
    subdivisionNumber: string,
    excludeParcelId?: string
  ): Promise<{ isDuplicate: boolean; ownerName?: string; holdingId?: string }> {
    const db = await getDatabase();
    const cleanSurvey = surveyNumber.trim().toUpperCase();
    const cleanSubdiv = subdivisionNumber.trim().toUpperCase();

    let sql = `
      SELECT sp.parcel_id, sp.holding_id, b.name as owner_name
      FROM survey_parcels sp
      JOIN land_holdings lh ON sp.holding_id = lh.holding_id
      JOIN beneficiaries b ON lh.beneficiary_id = b.beneficiary_id
      WHERE UPPER(TRIM(sp.survey_number)) = ?
        AND UPPER(TRIM(sp.subdivision_number)) = ?
        AND sp.status = 'ACTIVE'
        AND lh.status = 'ACTIVE'
    `;
    const params: any[] = [cleanSurvey, cleanSubdiv];

    if (excludeParcelId) {
      sql += ' AND sp.parcel_id != ?';
      params.push(excludeParcelId);
    }
    sql += ' LIMIT 1;';

    const match = await db.getFirstAsync<{ parcel_id: string; holding_id: string; owner_name: string }>(sql, params);
    if (match) {
      return { isDuplicate: true, ownerName: match.owner_name, holdingId: match.holding_id };
    }
    return { isDuplicate: false };
  }

  /**
   * Update holding project and declared area
   */
  async updateHolding(holdingId: string, projectId: string, declaredArea: number, updatedBy?: string): Promise<LandHolding> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const existing = await this.getHoldingById(holdingId);
    if (!existing) throw new Error('Holding not found');

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        UPDATE land_holdings
        SET project_id = ?, declared_total_area = ?, sync_status = 'PENDING_SYNC', updated_at = ?
        WHERE holding_id = ?;
      `, [projectId, declaredArea, now, holdingId]);

      // Update total land on beneficiary
      await db.runAsync(`
        UPDATE beneficiaries 
        SET total_land_acres = (
          SELECT COALESCE(SUM(declared_total_area), 0) 
          FROM land_holdings 
          WHERE beneficiary_id = ? AND status = 'ACTIVE'
        ),
        updated_at = ?
        WHERE beneficiary_id = ?;
      `, [existing.beneficiary_id, now, existing.beneficiary_id]);

      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'LAND_HOLDING', ?, 'UPDATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-hld-update-${holdingId}-${Date.now()}`,
        holdingId,
        JSON.stringify({ holding_id: holdingId, project_id: projectId, declared_total_area: declaredArea }),
      ]);
    });

    const updated = await this.getHoldingById(holdingId);
    return updated!;
  }

  /**
   * Add a single parcel to an existing holding
   */
  async addParcel(holdingId: string, parcel: CreateParcelInput, createdBy?: string): Promise<SurveyParcel> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const parcelId = `pcl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Check duplicate
    const isDup = await this.checkCompositeDuplicate(holdingId, parcel.survey_number, parcel.subdivision_number);
    if (isDup) {
      throw new Error(`Survey ${parcel.survey_number} / Subdivision ${parcel.subdivision_number} already exists in this holding`);
    }

    const globalCheck = await this.checkGlobalParcelDuplicate(parcel.survey_number, parcel.subdivision_number);
    if (globalCheck.isDuplicate) {
      throw new Error(`Survey ${parcel.survey_number} / Subdivision ${parcel.subdivision_number} is already registered to ${globalCheck.ownerName}`);
    }

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        INSERT INTO survey_parcels (
          parcel_id, holding_id, survey_number, subdivision_number, area, status, sync_status, local_version, server_version, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'PENDING_SYNC', 1, 0, ?, ?, ?);
      `, [
        parcelId,
        holdingId,
        parcel.survey_number.trim(),
        parcel.subdivision_number.trim(),
        parcel.area,
        createdBy || 'FIELD_OFFICER',
        now,
        now,
      ]);

      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'SURVEY_PARCEL', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-pcl-create-${parcelId}`,
        parcelId,
        JSON.stringify({ ...parcel, parcel_id: parcelId, holding_id: holdingId }),
      ]);
    });

    const res = await db.getFirstAsync<SurveyParcel>('SELECT * FROM survey_parcels WHERE parcel_id = ?;', [parcelId]);
    return res!;
  }

  /**
   * Update an existing parcel
   */
  async updateParcel(parcelId: string, parcel: CreateParcelInput, updatedBy?: string): Promise<SurveyParcel> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const existing = await db.getFirstAsync<SurveyParcel>('SELECT * FROM survey_parcels WHERE parcel_id = ?;', [parcelId]);
    if (!existing) throw new Error('Parcel not found');

    const isDup = await this.checkCompositeDuplicate(existing.holding_id, parcel.survey_number, parcel.subdivision_number, parcelId);
    if (isDup) {
      throw new Error(`Survey ${parcel.survey_number} / Subdivision ${parcel.subdivision_number} already exists in this holding`);
    }

    const globalCheck = await this.checkGlobalParcelDuplicate(parcel.survey_number, parcel.subdivision_number, parcelId);
    if (globalCheck.isDuplicate) {
      throw new Error(`Survey ${parcel.survey_number} / Subdivision ${parcel.subdivision_number} is already registered to ${globalCheck.ownerName}`);
    }

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        UPDATE survey_parcels
        SET survey_number = ?, subdivision_number = ?, area = ?, sync_status = 'PENDING_SYNC', updated_at = ?
        WHERE parcel_id = ?;
      `, [parcel.survey_number.trim(), parcel.subdivision_number.trim(), parcel.area, now, parcelId]);

      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'SURVEY_PARCEL', ?, 'UPDATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-pcl-update-${parcelId}-${Date.now()}`,
        parcelId,
        JSON.stringify({ ...parcel, parcel_id: parcelId }),
      ]);
    });

    const updated = await db.getFirstAsync<SurveyParcel>('SELECT * FROM survey_parcels WHERE parcel_id = ?;', [parcelId]);
    return updated!;
  }

  /**
   * Delete / Archive a parcel
   */
  async deleteParcel(parcelId: string, deletedBy?: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        UPDATE survey_parcels
        SET status = 'ARCHIVED', sync_status = 'PENDING_SYNC', updated_at = ?
        WHERE parcel_id = ?;
      `, [now, parcelId]);

      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'SURVEY_PARCEL', ?, 'VOID', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-pcl-void-${parcelId}-${Date.now()}`,
        parcelId,
        JSON.stringify({ parcel_id: parcelId, status: 'ARCHIVED' }),
      ]);
    });
  }

  /**
   * Deactivate a land holding
   */
  async deactivateHolding(holdingId: string, reason: string, userId?: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const existing = await this.getHoldingById(holdingId);
    if (!existing) throw new Error('Holding not found');

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        UPDATE land_holdings
        SET status = 'INACTIVE', sync_status = 'PENDING_SYNC', updated_at = ?
        WHERE holding_id = ?;
      `, [now, holdingId]);

      // Archive holding parcels
      await db.runAsync(`
        UPDATE survey_parcels
        SET status = 'INACTIVE', sync_status = 'PENDING_SYNC', updated_at = ?
        WHERE holding_id = ?;
      `, [now, holdingId]);

      // Update beneficiary total land
      await db.runAsync(`
        UPDATE beneficiaries 
        SET total_land_acres = (
          SELECT COALESCE(SUM(declared_total_area), 0) 
          FROM land_holdings 
          WHERE beneficiary_id = ? AND status = 'ACTIVE'
        ),
        updated_at = ?
        WHERE beneficiary_id = ?;
      `, [existing.beneficiary_id, now, existing.beneficiary_id]);

      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'LAND_HOLDING', ?, 'DEACTIVATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-hld-deact-${holdingId}-${Date.now()}`,
        holdingId,
        JSON.stringify({ holding_id: holdingId, reason }),
      ]);
    });
  }
}

