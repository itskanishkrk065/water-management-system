import { getDatabase } from '../db/database';
import { RegistrationDraft } from '../types/domain';

export class DraftRepository {
  /**
   * Save or update a local draft progressively
   */
  async saveDraft(draft: Partial<RegistrationDraft> & { phone_number: string }): Promise<RegistrationDraft> {
    const db = await getDatabase();
    const draftId = draft.draft_id || `draft-${draft.phone_number}`;
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO local_drafts (
        draft_id, step, phone_number, name, email,
        address_line1, address_line2, district_id, block_id, village_id, pincode,
        holdings_json, water_required_litres, project_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(draft_id) DO UPDATE SET
        step = excluded.step,
        name = excluded.name,
        email = excluded.email,
        address_line1 = excluded.address_line1,
        address_line2 = excluded.address_line2,
        district_id = excluded.district_id,
        block_id = excluded.block_id,
        village_id = excluded.village_id,
        pincode = excluded.pincode,
        holdings_json = excluded.holdings_json,
        water_required_litres = excluded.water_required_litres,
        project_id = excluded.project_id,
        updated_at = excluded.updated_at;
    `;

    await db.runAsync(sql, [
      draftId,
      draft.step || 1,
      draft.phone_number,
      draft.name || '',
      draft.email || null,
      draft.address_line1 || null,
      draft.address_line2 || null,
      draft.district_id || null,
      draft.block_id || null,
      draft.village_id || null,
      draft.pincode || null,
      draft.holdings_json || '[]',
      draft.water_required_litres || null,
      draft.project_id || null,
      now,
      now,
    ]);

    const saved = await this.getById(draftId);
    return saved!;
  }

  /**
   * Get draft by ID
   */
  async getById(draftId: string): Promise<RegistrationDraft | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<RegistrationDraft>(
      'SELECT * FROM local_drafts WHERE draft_id = ?;',
      [draftId]
    );
  }

  /**
   * Find draft by phone number
   */
  async findByPhone(phone: string): Promise<RegistrationDraft | null> {
    const db = await getDatabase();
    return await db.getFirstAsync<RegistrationDraft>(
      'SELECT * FROM local_drafts WHERE phone_number = ? LIMIT 1;',
      [phone]
    );
  }

  /**
   * Get all drafts
   */
  async getAll(): Promise<RegistrationDraft[]> {
    const db = await getDatabase();
    return await db.getAllAsync<RegistrationDraft>(
      'SELECT * FROM local_drafts ORDER BY updated_at DESC;'
    );
  }

  /**
   * Delete a draft after successful final registration or discard
   */
  async deleteDraft(draftId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM local_drafts WHERE draft_id = ?;', [draftId]);
  }
}
