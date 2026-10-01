import { getDatabase } from '../db/database';
import { DevelopmentBill, Installment, Payment, RunningBill, PaymentMode } from '../types/domain';

export interface RecordPaymentInput {
  beneficiary_id: string;
  bill_id?: string;
  installment_id?: string;
  running_bill_id?: string;
  extension_id?: string;
  amount: number;
  payment_mode: PaymentMode;
  payment_reference?: string;
  remarks?: string;
  recorded_by?: string;
}

export interface CreateRunningBillInput {
  allotment_id: string;
  beneficiary_id: string;
  rate_id: string;
  billing_period: string;
  approved_litres_snapshot: number;
  running_cost_per_litre_snapshot: number;
  created_by?: string;
}

export class BillingRepository {
  /**
   * Get all development bills with installments for a beneficiary
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
   * Get all running bills for a beneficiary
   */
  async getRunningBillsByBeneficiaryId(beneficiaryId: string): Promise<RunningBill[]> {
    const db = await getDatabase();
    return await db.getAllAsync<RunningBill>(
      'SELECT * FROM running_bills WHERE beneficiary_id = ? ORDER BY created_at DESC;',
      [beneficiaryId]
    );
  }

  /**
   * Get single development bill by ID with installments
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
   * Create a Running Bill for an active allotment
   */
  async createRunningBill(input: CreateRunningBillInput): Promise<RunningBill> {
    const db = await getDatabase();
    const rbId = `rb-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();
    const totalAmount =
      Math.round(input.approved_litres_snapshot * input.running_cost_per_litre_snapshot * 100) / 100;

    await db.withTransactionAsync(async () => {
      await db.runAsync(`
        INSERT INTO running_bills (
          running_bill_id, allotment_id, beneficiary_id, rate_id, billing_period,
          approved_litres_snapshot, running_cost_per_litre_snapshot, amount_due, amount_paid, pending_amount,
          status, sync_status, local_version, server_version, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, 'PENDING', 'PENDING_SYNC', 1, 0, ?, ?, ?);
      `, [
        rbId,
        input.allotment_id,
        input.beneficiary_id,
        input.rate_id,
        input.billing_period,
        input.approved_litres_snapshot,
        input.running_cost_per_litre_snapshot,
        totalAmount,
        totalAmount,
        input.created_by || 'ADMIN',
        now,
        now,
      ]);

      // Sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'RUNNING_BILL', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-rb-create-${rbId}`,
        rbId,
        JSON.stringify({ ...input, running_bill_id: rbId, amount_due: totalAmount }),
      ]);
    });

    const created = await db.getFirstAsync<RunningBill>(
      'SELECT * FROM running_bills WHERE running_bill_id = ?;',
      [rbId]
    );
    return created!;
  }

  /**
   * Get all payments for a beneficiary or bill
   */
  async getPayments(beneficiaryId?: string, billId?: string): Promise<Payment[]> {
    const db = await getDatabase();
    let sql = 'SELECT * FROM payments WHERE 1=1';
    const params: any[] = [];

    if (beneficiaryId) {
      sql += ' AND beneficiary_id = ?';
      params.push(beneficiaryId);
    }
    if (billId) {
      sql += ' AND bill_id = ?';
      params.push(billId);
    }

    sql += ' ORDER BY payment_date DESC;';
    return await db.getAllAsync<Payment>(sql, params);
  }

  /**
   * Record a payment and accurately update installment/bill balances
   */
  async recordPayment(input: RecordPaymentInput): Promise<Payment> {
    const db = await getDatabase();
    const paymentId = `pay-${Date.now().toString().slice(-6)}`;
    const receiptNumber = `RCP-M-${Date.now().toString().slice(-7)}`;
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      // 1. Insert Payment Record
      await db.runAsync(`
        INSERT INTO payments (
          payment_id, beneficiary_id, bill_id, installment_id, running_bill_id, extension_id,
          receipt_number, amount, payment_mode, payment_reference, payment_date, status, is_reversal, remarks,
          recorded_by, sync_status, local_version, server_version, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', 0, ?, ?, 'PENDING_SYNC', 1, 0, ?);
      `, [
        paymentId,
        input.beneficiary_id,
        input.bill_id || null,
        input.installment_id || null,
        input.running_bill_id || null,
        input.extension_id || null,
        receiptNumber,
        input.amount,
        input.payment_mode,
        input.payment_reference || null,
        now,
        input.remarks || null,
        input.recorded_by || 'FIELD_OFFICER',
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

      // 3. Update Development Bill if specified
      if (input.bill_id) {
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
      }

      // 4. Update Running Bill if specified
      if (input.running_bill_id) {
        await db.runAsync(`
          UPDATE running_bills 
          SET amount_paid = amount_paid + ?,
              pending_amount = MAX(0, amount_due - (amount_paid + ?)),
              status = CASE 
                WHEN (amount_paid + ?) >= amount_due THEN 'PAID'
                WHEN (amount_paid + ?) > 0 THEN 'PARTIALLY_PAID'
                ELSE 'PENDING'
              END,
              updated_at = ?
          WHERE running_bill_id = ?;
        `, [input.amount, input.amount, input.amount, input.amount, now, input.running_bill_id]);
      }

      // 5. Sync queue
      await db.runAsync(`
        INSERT INTO sync_queue (id, operation_id, entity_type, entity_id, operation_type, payload, status)
        VALUES (?, ?, 'PAYMENT', ?, 'CREATE', ?, 'PENDING');
      `, [
        `sq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        `op-pay-create-${paymentId}`,
        paymentId,
        JSON.stringify({ ...input, payment_id: paymentId, receipt_number: receiptNumber }),
      ]);

      // 6. Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'USER', 'MOBILE-DEVICE', 'PAYMENT', ?, 'PAYMENT_RECORDED', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        input.recorded_by || 'FIELD_OFFICER',
        paymentId,
        JSON.stringify({ amount: input.amount, receipt: receiptNumber, mode: input.payment_mode }),
        now,
      ]);
    });

    const payment = await db.getFirstAsync<Payment>('SELECT * FROM payments WHERE payment_id = ?;', [paymentId]);
    return payment!;
  }

  /**
   * Reverse a recorded payment
   */
  async reversePayment(paymentId: string, reason: string, reversedBy: string = 'ADMIN'): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const payment = await db.getFirstAsync<Payment>('SELECT * FROM payments WHERE payment_id = ?;', [paymentId]);
    if (!payment) throw new Error('Payment not found');
    if (payment.is_reversal || payment.status === 'REVERSED') {
      throw new Error('Payment has already been reversed');
    }

    await db.withTransactionAsync(async () => {
      // 1. Mark payment as reversed
      await db.runAsync(
        'UPDATE payments SET status = "REVERSED", is_reversal = 1, remarks = ? WHERE payment_id = ?;',
        [`Reversed: ${reason}`, paymentId]
      );

      // 2. Deduct from installment if attached
      if (payment.installment_id) {
        await db.runAsync(`
          UPDATE installments 
          SET amount_paid = MAX(0, amount_paid - ?),
              pending_amount = MIN(amount_due, pending_amount + ?),
              status = CASE 
                WHEN (amount_paid - ?) <= 0 THEN 'PENDING'
                ELSE 'PARTIALLY_PAID'
              END,
              updated_at = ?
          WHERE installment_id = ?;
        `, [payment.amount, payment.amount, payment.amount, now, payment.installment_id]);
      }

      // 3. Deduct from bill if attached
      if (payment.bill_id) {
        await db.runAsync(`
          UPDATE development_bills 
          SET amount_paid = MAX(0, amount_paid - ?),
              pending_amount = MIN(total_amount, pending_amount + ?),
              status = CASE 
                WHEN (amount_paid - ?) <= 0 THEN 'PENDING'
                ELSE 'PARTIALLY_PAID'
              END,
              updated_at = ?
          WHERE bill_id = ?;
        `, [payment.amount, payment.amount, payment.amount, now, payment.bill_id]);
      }

      // 4. Audit
      await db.runAsync(`
        INSERT INTO local_audit_logs (audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp)
        VALUES (?, ?, 'ADMIN', 'MOBILE-DEVICE', 'PAYMENT', ?, 'PAYMENT_REVERSED', ?, ?);
      `, [
        `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        reversedBy,
        paymentId,
        JSON.stringify({ amount: payment.amount, reason }),
        now,
      ]);
    });
  }

  /**
   * Get formatted receipt metadata
   */
  async getReceipt(paymentId: string): Promise<{
    payment: Payment;
    beneficiaryName: string;
    beneficiaryPhone: string;
    villageName: string;
    installmentNumber?: number;
    milestoneName?: string;
  } | null> {
    const db = await getDatabase();
    const sql = `
      SELECT p.*, 
             b.name as beneficiary_name, 
             b.phone_number as beneficiary_phone,
             v.name as village_name,
             inst.installment_number,
             inst.milestone_name
      FROM payments p
      JOIN beneficiaries b ON p.beneficiary_id = b.beneficiary_id
      LEFT JOIN villages v ON b.village_id = v.village_id
      LEFT JOIN installments inst ON p.installment_id = inst.installment_id
      WHERE p.payment_id = ?;
    `;
    const res = await db.getFirstAsync<any>(sql, [paymentId]);
    if (!res) return null;

    return {
      payment: res,
      beneficiaryName: res.beneficiary_name,
      beneficiaryPhone: res.beneficiary_phone,
      villageName: res.village_name || 'Coimbatore Rural',
      installmentNumber: res.installment_number,
      milestoneName: res.milestone_name,
    };
  }
}
