import { getDatabase } from '../db/database';
import { DevelopmentBill, Installment, Payment } from '../types/domain';

export interface RecordPaymentInput {
  bill_id: string;
  installment_id?: string;
  beneficiary_id: string;
  amount: number;
  payment_mode: 'CASH' | 'CHEQUE' | 'NEFT' | 'RTGS' | 'UPI' | 'OFFLINE';
  payment_reference?: string;
  created_by?: string;
}

export class BillingRepository {
  /**
   * Get all bills with installments for a beneficiary
   */
  async getByBeneficiaryId(beneficiaryId: string): Promise<DevelopmentBill[]> {
    const db = await getDatabase();
    const bills = await db.getAllAsync<DevelopmentBill>(
      'SELECT * FROM development_bills WHERE beneficiary_id = ? ORDER BY created_at DESC;',
      [beneficiaryId]
    );

    for (const bill of bills) {
      bill.installments = await db.getAllAsync<Installment>(
        'SELECT * FROM installments WHERE bill_id = ? ORDER BY installment_number ASC;',
        [bill.bill_id]
      );
    }

    return bills;
  }

  /**
   * Get single bill by ID with installments
   */
  async getById(billId: string): Promise<DevelopmentBill | null> {
    const db = await getDatabase();
    const bill = await db.getFirstAsync<DevelopmentBill>(
      'SELECT * FROM development_bills WHERE bill_id = ?;',
      [billId]
    );
    if (!bill) return null;

    bill.installments = await db.getAllAsync<Installment>(
      'SELECT * FROM installments WHERE bill_id = ? ORDER BY installment_number ASC;',
      [billId]
    );
    return bill;
  }

  /**
   * Get all payments for a bill
   */
  async getPayments(billId: string): Promise<Payment[]> {
    const db = await getDatabase();
    return await db.getAllAsync<Payment>(
      'SELECT * FROM payments WHERE bill_id = ? ORDER BY payment_date DESC;',
      [billId]
    );
  }

  /**
   * Record a payment and update installment/bill balances
   */
  async recordPayment(input: RecordPaymentInput): Promise<Payment> {
    const db = await getDatabase();
    const paymentId = `pay-${Date.now().toString().slice(-6)}`;
    const receiptNumber = `RCP-M-${Date.now().toString().slice(-7)}`;
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      // 1. Insert Payment
      await db.runAsync(`
        INSERT INTO payments (
          payment_id, bill_id, installment_id, beneficiary_id, receipt_number, amount,
          payment_mode, payment_reference, payment_date, is_reversal, sync_status, local_version, server_version, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING_SYNC', 1, 0, ?, ?);
      `, [
        paymentId,
        input.bill_id,
        input.installment_id || null,
        input.beneficiary_id,
        receiptNumber,
        input.amount,
        input.payment_mode,
        input.payment_reference || null,
        now,
        input.created_by || 'FIELD_OFFICER',
        now,
      ]);

      // 2. Update Installment if specified
      if (input.installment_id) {
        await db.runAsync(`
          UPDATE installments 
          SET amount_paid = amount_paid + ?,
              pending_amount = MAX(0, amount_due - (amount_paid + ?)),
              status = CASE 
                WHEN (amount_paid + ?) >= amount_due THEN 'PAID'
                WHEN (amount_paid + ?) > 0 THEN 'PARTIALLY_PAID'
                ELSE 'PENDING'
              END,
              updated_at = ?
          WHERE installment_id = ?;
        `, [input.amount, input.amount, input.amount, input.amount, now, input.installment_id]);
      }

      // 3. Update Bill
      await db.runAsync(`
        UPDATE development_bills 
        SET amount_paid = amount_paid + ?,
            pending_amount = MAX(0, total_amount - (amount_paid + ?)),
            status = CASE 
              WHEN (amount_paid + ?) >= total_amount THEN 'PAID'
              WHEN (amount_paid + ?) > 0 THEN 'PARTIALLY_PAID'
              ELSE 'PENDING'
            END,
            updated_at = ?
        WHERE bill_id = ?;
      `, [input.amount, input.amount, input.amount, input.amount, now, input.bill_id]);

      // 4. Sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'PAYMENT', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-pay-create-${paymentId}`,
        paymentId,
        JSON.stringify({ ...input, payment_id: paymentId, receipt_number: receiptNumber }),
      ]);

      // 5. Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'FIELD_OFFICER', 'MOBILE-DEVICE', 'PAYMENT', ?, 'RECORD', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        input.created_by || 'FIELD_OFFICER',
        paymentId,
        JSON.stringify({ amount: input.amount, receipt: receiptNumber }),
        now,
      ]);
    });

    const payment = await db.getFirstAsync<Payment>('SELECT * FROM payments WHERE payment_id = ?;', [paymentId]);
    return payment!;
  }
}
