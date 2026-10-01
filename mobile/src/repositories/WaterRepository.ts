import { getDatabase } from '../db/database';
import { WaterApplication, WaterAllotment, RateTariff, WaterApplicationStatus } from '../types/domain';

export interface CreateWaterApplicationInput {
  beneficiary_id: string;
  holding_id: string;
  project_id: string;
  required_litres: number;
  remarks?: string;
  created_by?: string;
}

export class WaterRepository {
  /**
   * Get active rate tariff for a project
   */
  async getActiveTariff(projectId: string): Promise<RateTariff | null> {
    const db = await getDatabase();
    const sql = `
      SELECT * FROM rate_tariffs 
      WHERE project_id = ? AND is_active = 1 
      ORDER BY effective_from DESC 
      LIMIT 1;
    `;
    const tariff = await db.getFirstAsync<RateTariff>(sql, [projectId]);
    return tariff || null;
  }

  /**
   * Get all active water applications (excludes REJECTED, CANCELLED, VOIDED)
   */
  async getActiveApplications(): Promise<WaterApplication[]> {
    const db = await getDatabase();
    const sql = `
      SELECT wa.*, 
             b.name as beneficiary_name, 
             b.phone_number as beneficiary_phone,
             v.name as village_name
      FROM water_applications wa
      JOIN beneficiaries b ON wa.beneficiary_id = b.beneficiary_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      WHERE wa.status NOT IN ('REJECTED', 'CANCELLED', 'VOIDED')
      ORDER BY wa.created_at DESC;
    `;
    return await db.getAllAsync<WaterApplication>(sql);
  }

  /**
   * Get historical water applications (REJECTED, CANCELLED, VOIDED)
   */
  async getHistoricalApplications(): Promise<WaterApplication[]> {
    const db = await getDatabase();
    const sql = `
      SELECT wa.*, 
             b.name as beneficiary_name, 
             b.phone_number as beneficiary_phone,
             v.name as village_name
      FROM water_applications wa
      JOIN beneficiaries b ON wa.beneficiary_id = b.beneficiary_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      WHERE wa.status IN ('REJECTED', 'CANCELLED', 'VOIDED')
      ORDER BY wa.updated_at DESC;
    `;
    return await db.getAllAsync<WaterApplication>(sql);
  }

  /**
   * Get all water applications for a specific beneficiary
   */
  async getByBeneficiaryId(beneficiaryId: string): Promise<WaterApplication[]> {
    const db = await getDatabase();
    const sql = `
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
    return await db.getAllAsync<WaterApplication>(sql, [beneficiaryId]);
  }

  /**
   * Get single application by ID with allotment if present
   */
  async getById(applicationId: string): Promise<WaterApplication | null> {
    const db = await getDatabase();
    const sql = `
      SELECT wa.*, 
             b.name as beneficiary_name, 
             b.phone_number as beneficiary_phone,
             v.name as village_name
      FROM water_applications wa
      JOIN beneficiaries b ON wa.beneficiary_id = b.beneficiary_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      WHERE wa.application_id = ?;
    `;
    const app = await db.getFirstAsync<WaterApplication>(sql, [applicationId]);
    if (!app) return null;

    const allotment = await db.getFirstAsync<WaterAllotment>(
      'SELECT * FROM water_allotments WHERE application_id = ?;',
      [applicationId]
    );
    app.allotment = allotment || null;
    return app;
  }

  /**
   * Create a new Water Application locally
   */
  async createApplication(input: CreateWaterApplicationInput): Promise<WaterApplication> {
    const db = await getDatabase();
    const appId = `app-wa-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    // 1. Fetch holding to calculate quota
    const holding = await db.getFirstAsync<{ declared_total_area: number }>(
      'SELECT declared_total_area FROM land_holdings WHERE holding_id = ?;',
      [input.holding_id]
    );
    if (!holding) {
      throw new Error('Associated land holding not found');
    }

    // 2. Fetch active tariff snapshot
    const tariff = await this.getActiveTariff(input.project_id);
    if (!tariff) {
      throw new Error('No active rate tariff found for project');
    }

    // Calculated allocation = litres_per_acre * declared_total_area
    const calculatedLitres = tariff.litres_per_acre * holding.declared_total_area;

    await db.withTransactionAsync(async () => {
      // Insert Application
      await db.runAsync(`
        INSERT INTO water_applications (
          application_id, beneficiary_id, holding_id, project_id,
          rate_id_snapshot, required_litres, calculated_litres,
          litres_per_acre_snapshot, development_cost_per_litre_snapshot,
          status, application_date, remarks, sync_status, local_version, server_version, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?, 'PENDING_SYNC', 1, 0, ?, ?, ?);
      `, [
        appId,
        input.beneficiary_id,
        input.holding_id,
        input.project_id,
        tariff.rate_id,
        input.required_litres,
        calculatedLitres,
        tariff.litres_per_acre,
        tariff.development_cost_per_litre,
        now,
        input.remarks || null,
        input.created_by || 'FIELD_OFFICER',
        now,
        now,
      ]);

      // Record in sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'WATER_APPLICATION', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-app-create-${appId}`,
        appId,
        JSON.stringify({ ...input, application_id: appId, calculated_litres: calculatedLitres }),
      ]);

      // Record audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'FIELD_OFFICER', 'MOBILE-DEVICE', 'WATER_APPLICATION', ?, 'CREATE', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        input.created_by || 'FIELD_OFFICER',
        appId,
        JSON.stringify({ required_litres: input.required_litres, calculated_litres: calculatedLitres }),
        now,
      ]);
    });

    const created = await this.getById(appId);
    return created!;
  }

  /**
   * Approve a Water Application (Admin action: creates Allotment, Bill, and 5-stage Installments)
   */
  async approveApplication(
    applicationId: string,
    approvedLitres: number,
    approvedBy: string = 'ADMIN'
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const app = await this.getById(applicationId);
    if (!app) throw new Error('Application not found');

    const allotmentId = `alt-${Date.now().toString().slice(-6)}`;
    const billId = `bill-${Date.now().toString().slice(-6)}`;

    // Total development bill = approved_litres * development_cost_per_litre_snapshot
    const totalBillAmount = approvedLitres * app.development_cost_per_litre_snapshot;

    // 5-Stage Installments percentages: 2.5%, 20%, 25%, 25%, 27.5%
    const stages = [
      { num: 1, pct: 2.5, name: 'Initial Administrative Fee', days: 15 },
      { num: 2, pct: 20.0, name: 'Pipeline Excavation & Laying', days: 45 },
      { num: 3, pct: 25.0, name: 'Main Storage Delivery', days: 90 },
      { num: 4, pct: 25.0, name: 'Distribution Valves Installation', days: 135 },
      { num: 5, pct: 27.5, name: 'Final Commissioning & Water Release', days: 180 },
    ];

    await db.withTransactionAsync(async () => {
      // 1. Update Application status to APPROVED
      await db.runAsync(
        'UPDATE water_applications SET status = "APPROVED", updated_at = ? WHERE application_id = ?;',
        [now, applicationId]
      );

      // 2. Insert Water Allotment
      await db.runAsync(`
        INSERT INTO water_allotments (
          allotment_id, application_id, beneficiary_id, holding_id, approved_litres, approved_at, approved_by, is_active, status, sync_status, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', 'PENDING_SYNC', ?, ?);
      `, [
        allotmentId,
        applicationId,
        app.beneficiary_id,
        app.holding_id,
        approvedLitres,
        now,
        approvedBy,
        approvedBy,
        now,
      ]);

      // 3. Lock Land Holding
      await db.runAsync('UPDATE land_holdings SET is_locked = 1, updated_at = ? WHERE holding_id = ?;', [
        now,
        app.holding_id,
      ]);

      // 4. Create Development Bill
      await db.runAsync(`
        INSERT INTO development_bills (
          bill_id, beneficiary_id, allotment_id, approved_litres_snapshot, development_cost_per_litre_snapshot, total_amount, amount_paid, pending_amount, status, sync_status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0.0, ?, 'PENDING', 'PENDING_SYNC', ?, ?, ?);
      `, [
        billId,
        app.beneficiary_id,
        allotmentId,
        approvedLitres,
        app.development_cost_per_litre_snapshot,
        totalBillAmount,
        totalBillAmount,
        approvedBy,
        now,
        now,
      ]);

      // 5. Insert 5 Installments
      for (const st of stages) {
        const instId = `inst-${billId.slice(-4)}-${st.num}`;
        const amountDue = Math.round(((totalBillAmount * st.pct) / 100) * 100) / 100;
        const dueDate = new Date(Date.now() + st.days * 86400000).toISOString().split('T')[0];

        await db.runAsync(`
          INSERT INTO installments (
            installment_id, bill_id, installment_number, percentage, amount_due, amount_paid, pending_amount, due_date, status, milestone_name, sync_status, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 0.0, ?, ?, 'PENDING', ?, 'PENDING_SYNC', ?, ?, ?);
        `, [
          instId,
          billId,
          st.num,
          st.pct,
          amountDue,
          amountDue,
          dueDate,
          st.name,
          approvedBy,
          now,
          now,
        ]);
      }

      // 6. Record Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'ADMIN', 'MOBILE-DEVICE', 'WATER_APPLICATION', ?, 'APPROVE', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        approvedBy,
        applicationId,
        JSON.stringify({ approved_litres: approvedLitres, bill_total: totalBillAmount }),
        now,
      ]);
    });
  }

  /**
   * Reject a Water Application
   */
  async rejectApplication(
    applicationId: string,
    reason?: string,
    user: string = 'ADMIN'
  ): Promise<void> {
    return this.updateStatus(applicationId, 'REJECTED', reason, user);
  }

  /**
   * Cancel or Reject an application (moves to History)
   */
  async updateStatus(
    applicationId: string,
    status: WaterApplicationStatus,
    reason?: string,
    user: string = 'FIELD_OFFICER'
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      'UPDATE water_applications SET status = ?, remarks = COALESCE(?, remarks), updated_at = ? WHERE application_id = ?;',
      [status, reason || null, now, applicationId]
    );

    // Record Audit
    await db.runAsync(`
      INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
      VALUES (?, ?, 'USER', 'MOBILE-DEVICE', 'WATER_APPLICATION', ?, ?, ?, ?);
    `, [
      `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user,
      applicationId,
      status,
      JSON.stringify({ status, reason }),
      now,
    ]);
  }

  /**
   * Update draft water application
   */
  async updateDraft(applicationId: string, requiredLitres: number, remarks?: string): Promise<WaterApplication> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const app = await this.getById(applicationId);
    if (!app) throw new Error('Application not found');
    if (app.status !== 'DRAFT') throw new Error('Only draft applications can be edited');

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        UPDATE water_applications 
        SET required_litres = ?, remarks = COALESCE(?, remarks), updated_at = ?
        WHERE application_id = ?;
      `, [requiredLitres, remarks || null, now, applicationId]);

      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'WATER_APPLICATION', ?, 'UPDATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-wa-draft-${applicationId}-${Date.now()}`,
        applicationId,
        JSON.stringify({ application_id: applicationId, required_litres: requiredLitres }),
      ]);
    });

    const updated = await this.getById(applicationId);
    return updated!;
  }

  /**
   * Submit a draft water application
   */
  async submitDraft(applicationId: string, submittedBy: string = 'FIELD_OFFICER'): Promise<void> {
    return this.updateStatus(applicationId, 'SUBMITTED', 'Submitted for administrative approval', submittedBy);
  }

  /**
   * Cancel an application
   */
  async cancelApplication(applicationId: string, reason?: string, user: string = 'FIELD_OFFICER'): Promise<void> {
    return this.updateStatus(applicationId, 'CANCELLED', reason || 'Cancelled by applicant/officer', user);
  }

  /**
   * Returns separated current vs history applications for a beneficiary
   */
  async getCurrentAndHistory(beneficiaryId: string): Promise<{
    current: WaterApplication[];
    history: WaterApplication[];
  }> {
    const all = await this.getByBeneficiaryId(beneficiaryId);
    const current = all.filter((a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW' || a.status === 'DRAFT' || a.status === 'APPROVED');
    const history = all.filter((a) => a.status === 'REJECTED' || a.status === 'CANCELLED' || a.status === 'VOIDED');
    return { current, history };
  }
}
