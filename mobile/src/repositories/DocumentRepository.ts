import { getDatabase } from '../db/database';
import { BeneficiaryDocument, DocumentCategory } from '../types/domain';

export interface CreateDocumentInput {
  beneficiary_id: string;
  category: DocumentCategory;
  title: string;
  file_name: string;
  file_size_bytes?: number;
  mime_type?: string;
  storage_path: string;
  reference_id?: string;
}

export class DocumentRepository {
  /**
   * Get all documents for a beneficiary
   */
  async getByBeneficiaryId(beneficiaryId: string, categoryFilter?: DocumentCategory): Promise<BeneficiaryDocument[]> {
    const db = await getDatabase();
    let sql = 'SELECT * FROM beneficiary_documents WHERE beneficiary_id = ?';
    const params: any[] = [beneficiaryId];

    if (categoryFilter) {
      sql += ' AND category = ?';
      params.push(categoryFilter);
    }

    sql += ' ORDER BY created_at DESC;';
    return await db.getAllAsync<BeneficiaryDocument>(sql, params);
  }

  /**
   * Add a new document record
   */
  async addDocument(input: CreateDocumentInput): Promise<BeneficiaryDocument> {
    const db = await getDatabase();
    const docId = `doc-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        INSERT INTO beneficiary_documents (
          document_id, beneficiary_id, category, title, file_name,
          file_size_bytes, mime_type, storage_path, reference_id, sync_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SYNC', ?);
      `, [
        docId,
        input.beneficiary_id,
        input.category,
        input.title,
        input.file_name,
        input.file_size_bytes || null,
        input.mime_type || 'application/pdf',
        input.storage_path,
        input.reference_id || null,
        now,
      ]);

      // Sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'DOCUMENT', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-doc-create-${docId}`,
        docId,
        JSON.stringify({ ...input, document_id: docId }),
      ]);
    });

    const doc = await db.getFirstAsync<BeneficiaryDocument>(
      'SELECT * FROM beneficiary_documents WHERE document_id = ?;',
      [docId]
    );
    return doc!;
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM beneficiary_documents WHERE document_id = ?;', [documentId]);
  }
}
