import * as SQLite from 'expo-sqlite';

export async function seedDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    // 1. Users
    await db.runAsync(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, is_active, created_at)
      VALUES 
        ('usr-admin-01', 'Admin Officer', 'admin@watergrid.local', 'offline_admin_hash', 'ADMIN', 1, datetime('now')),
        ('usr-field-01', 'Ravi Kumar', 'field@watergrid.local', 'offline_field_hash', 'FIELD_OFFICER', 1, datetime('now'));
    `);

    // 2. Districts
    await db.runAsync(`
      INSERT OR REPLACE INTO districts (district_id, name, code)
      VALUES 
        ('dist-cbe', 'Coimbatore', 'CBE'),
        ('dist-tpr', 'Tiruppur', 'TPR');
    `);

    // 3. Blocks
    await db.runAsync(`
      INSERT OR REPLACE INTO blocks (block_id, district_id, name, code)
      VALUES 
        ('blk-pol-n', 'dist-cbe', 'Pollachi North', 'POL-N'),
        ('blk-pol-s', 'dist-cbe', 'Pollachi South', 'POL-S'),
        ('blk-sulur', 'dist-cbe', 'Sulur', 'SLR'),
        ('blk-udm', 'dist-tpr', 'Udumalpet', 'UDM');
    `);

    // 4. Villages
    await db.runAsync(`
      INSERT OR REPLACE INTO villages (village_id, block_id, name, code)
      VALUES 
        ('vil-anm', 'blk-pol-s', 'Anaimalai', 'ANM'),
        ('vil-zmn', 'blk-pol-n', 'Zamin Uthukuli', 'ZMN'),
        ('vil-vtk', 'blk-pol-s', 'Vettaikaranpudur', 'VTK'),
        ('vil-knt', 'blk-sulur', 'Kinathukadavu', 'KNT'),
        ('vil-mdt', 'blk-udm', 'Madathukulam', 'MDT');
    `);

    // 5. Project Scheme
    await db.runAsync(`
      INSERT OR REPLACE INTO project_schemes (project_id, project_name, project_code, is_active)
      VALUES 
        ('prj-csii', 'Coimbatore South Irrigation Initiative', 'CSII-2026', 1);
    `);

    // 6. Rate Tariff (5,000 L/Acre, ₹12.50 dev cost/L, ₹3.20 running cost/L)
    await db.runAsync(`
      INSERT OR REPLACE INTO rate_tariffs (rate_id, project_id, litres_per_acre, development_cost_per_litre, running_cost_per_litre, effective_from, is_active)
      VALUES 
        ('rate-2026-v1', 'prj-csii', 5000.0, 12.50, 3.20, '2026-01-01T00:00:00.000Z', 1);
    `);

    // 7. Seed Beneficiaries
    // Beneficiary 1: Kanishk
    await db.runAsync(`
      INSERT OR REPLACE INTO beneficiaries (
        beneficiary_id, name, phone_number, email, address_line1, address_line2, 
        district_id, block_id, village_id, pincode, total_land_acres, sync_status, created_by
      ) VALUES (
        'ben-kanishk-01', 'Kanishk R', '9876543210', 'kanishk@example.com', 
        '42 Green Valley Road', 'Near Main Tank', 'dist-cbe', 'blk-pol-s', 'vil-anm', '642104', 
        8.00, 'SYNCED', 'usr-field-01'
      );
    `);

    // Land Holdings for Kanishk
    // Holding #1 (5.00 acres) -> Approved water application
    await db.runAsync(`
      INSERT OR REPLACE INTO land_holdings (
        holding_id, beneficiary_id, project_id, declared_total_area, area_unit, status, is_locked, sync_status, created_by
      ) VALUES (
        'hld-kanishk-01', 'ben-kanishk-01', 'prj-csii', 5.00, 'acres', 'ACTIVE', 1, 'SYNCED', 'usr-field-01'
      );
    `);

    // Parcels for Holding #1: 101/1A (2.5 ac) and 101/1B (2.5 ac) -> Tests valid duplicate survey with distinct subdivision!
    await db.runAsync(`
      INSERT OR REPLACE INTO survey_parcels (
        parcel_id, holding_id, survey_number, subdivision_number, area, status, sync_status, created_by
      ) VALUES 
        ('pcl-01', 'hld-kanishk-01', '101', '1A', 2.50, 'ACTIVE', 'SYNCED', 'usr-field-01'),
        ('pcl-02', 'hld-kanishk-01', '101', '1B', 2.50, 'ACTIVE', 'SYNCED', 'usr-field-01');
    `);

    // Holding #2 (3.00 acres) -> No active water application (Eligible for application!)
    await db.runAsync(`
      INSERT OR REPLACE INTO land_holdings (
        holding_id, beneficiary_id, project_id, declared_total_area, area_unit, status, is_locked, sync_status, created_by
      ) VALUES (
        'hld-kanishk-02', 'ben-kanishk-01', 'prj-csii', 3.00, 'acres', 'ACTIVE', 0, 'SYNCED', 'usr-field-01'
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO survey_parcels (
        parcel_id, holding_id, survey_number, subdivision_number, area, status, sync_status, created_by
      ) VALUES 
        ('pcl-03', 'hld-kanishk-02', '102', '2', 3.00, 'ACTIVE', 'SYNCED', 'usr-field-01');
    `);

    // Water Application for Holding #1 (Approved)
    await db.runAsync(`
      INSERT OR REPLACE INTO water_applications (
        application_id, beneficiary_id, holding_id, project_id, rate_id_snapshot,
        required_litres, calculated_litres, litres_per_acre_snapshot, development_cost_per_litre_snapshot,
        status, application_date, remarks, sync_status, created_by
      ) VALUES (
        'app-wa-101', 'ben-kanishk-01', 'hld-kanishk-01', 'prj-csii', 'rate-2026-v1',
        25000.0, 25000.0, 5000.0, 12.50,
        'APPROVED', datetime('now', '-5 days'), 'Approved for organic farm', 'SYNCED', 'usr-field-01'
      );
    `);

    // Water Allotment for WA-101
    await db.runAsync(`
      INSERT OR REPLACE INTO water_allotments (
        allotment_id, application_id, beneficiary_id, holding_id, approved_litres,
        approved_at, approved_by, is_active, status, sync_status, created_by
      ) VALUES (
        'alt-101', 'app-wa-101', 'ben-kanishk-01', 'hld-kanishk-01', 25000.0,
        datetime('now', '-4 days'), 'usr-admin-01', 1, 'ACTIVE', 'SYNCED', 'usr-admin-01'
      );
    `);

    // Development Bill for Allotment 101: 25,000 L * ₹12.50 = ₹3,12,500
    await db.runAsync(`
      INSERT OR REPLACE INTO development_bills (
        bill_id, beneficiary_id, allotment_id, approved_litres_snapshot,
        development_cost_per_litre_snapshot, total_amount, amount_paid, pending_amount,
        status, sync_status, created_by
      ) VALUES (
        'bill-101', 'ben-kanishk-01', 'alt-101', 25000.0,
        12.50, 312500.00, 7812.50, 304687.50,
        'PARTIALLY_PAID', 'SYNCED', 'usr-admin-01'
      );
    `);

    // 5-Stage Installments for Bill 101 (2.5%, 20%, 25%, 25%, 27.5%)
    // Stage 1: 2.5% = ₹7,812.50 (Paid)
    // Stage 2: 20.0% = ₹62,500.00 (Pending)
    // Stage 3: 25.0% = ₹78,125.00 (Pending)
    // Stage 4: 25.0% = ₹78,125.00 (Pending)
    // Stage 5: 27.5% = ₹85,937.50 (Pending)
    await db.runAsync(`
      INSERT OR REPLACE INTO installments (
        installment_id, bill_id, installment_number, percentage, amount_due, amount_paid, pending_amount, due_date, status, milestone_name, sync_status
      ) VALUES 
        ('inst-101-1', 'bill-101', 1, 2.5, 7812.50, 7812.50, 0.00, date('now', '+15 days'), 'PAID', 'Initial Administrative Fee', 'SYNCED'),
        ('inst-101-2', 'bill-101', 2, 20.0, 62500.00, 0.00, 62500.00, date('now', '+45 days'), 'PENDING', 'Pipeline Excavation & Laying', 'SYNCED'),
        ('inst-101-3', 'bill-101', 3, 25.0, 78125.00, 0.00, 78125.00, date('now', '+90 days'), 'PENDING', 'Main Storage Delivery', 'SYNCED'),
        ('inst-101-4', 'bill-101', 4, 25.0, 78125.00, 0.00, 78125.00, date('now', '+135 days'), 'PENDING', 'Distribution Valves Installation', 'SYNCED'),
        ('inst-101-5', 'bill-101', 5, 27.5, 85937.50, 0.00, 85937.50, date('now', '+180 days'), 'PENDING', 'Final Commissioning & Water Release', 'SYNCED');
    `);

    // Payment for Stage 1
    await db.runAsync(`
      INSERT OR REPLACE INTO payments (
        payment_id, bill_id, installment_id, beneficiary_id, receipt_number, amount, payment_mode, payment_reference, payment_date, sync_status, created_by
      ) VALUES (
        'pay-101-1', 'bill-101', 'inst-101-1', 'ben-kanishk-01', 'RCP-2026-00101', 7812.50, 'CASH', 'OFFLINE-RCP-01', datetime('now', '-3 days'), 'SYNCED', 'usr-field-01'
      );
    `);

    // Beneficiary 2: Mani (Pending Sync state)
    await db.runAsync(`
      INSERT OR REPLACE INTO beneficiaries (
        beneficiary_id, name, phone_number, email, address_line1, address_line2, 
        district_id, block_id, village_id, pincode, total_land_acres, sync_status, created_by
      ) VALUES (
        'ben-mani-02', 'Mani Kandan', '9443322110', 'mani@example.com', 
        '12 North Street', 'Opposite Temple', 'dist-cbe', 'blk-pol-n', 'vil-zmn', '642004', 
        4.00, 'PENDING_SYNC', 'usr-field-01'
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO land_holdings (
        holding_id, beneficiary_id, project_id, declared_total_area, area_unit, status, is_locked, sync_status, created_by
      ) VALUES (
        'hld-mani-01', 'ben-mani-02', 'prj-csii', 4.00, 'acres', 'ACTIVE', 0, 'PENDING_SYNC', 'usr-field-01'
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO survey_parcels (
        parcel_id, holding_id, survey_number, subdivision_number, area, status, sync_status, created_by
      ) VALUES 
        ('pcl-mani-01', 'hld-mani-01', '205', '3A', 4.00, 'ACTIVE', 'PENDING_SYNC', 'usr-field-01');
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO water_applications (
        application_id, beneficiary_id, holding_id, project_id, rate_id_snapshot,
        required_litres, calculated_litres, litres_per_acre_snapshot, development_cost_per_litre_snapshot,
        status, application_date, remarks, sync_status, created_by
      ) VALUES (
        'app-wa-102', 'ben-mani-02', 'hld-mani-01', 'prj-csii', 'rate-2026-v1',
        20000.0, 20000.0, 5000.0, 12.50,
        'SUBMITTED', datetime('now', '-2 hours'), 'Applied offline in field', 'PENDING_SYNC', 'usr-field-01'
      );
    `);

    // Beneficiary 3: Priya (With a cancelled application in History)
    await db.runAsync(`
      INSERT OR REPLACE INTO beneficiaries (
        beneficiary_id, name, phone_number, email, address_line1, address_line2, 
        district_id, block_id, village_id, pincode, total_land_acres, sync_status, created_by
      ) VALUES (
        'ben-priya-03', 'Priya Shanmugam', '9789012345', 'priya@example.com', 
        '7 Coconut Grove', 'Canal Road', 'dist-tpr', 'blk-udm', 'vil-mdt', '642126', 
        6.00, 'SYNCED', 'usr-field-01'
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO land_holdings (
        holding_id, beneficiary_id, project_id, declared_total_area, area_unit, status, is_locked, sync_status, created_by
      ) VALUES (
        'hld-priya-01', 'ben-priya-03', 'prj-csii', 6.00, 'acres', 'ACTIVE', 0, 'SYNCED', 'usr-field-01'
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO survey_parcels (
        parcel_id, holding_id, survey_number, subdivision_number, area, status, sync_status, created_by
      ) VALUES 
        ('pcl-priya-01', 'hld-priya-01', '310', '1', 6.00, 'ACTIVE', 'SYNCED', 'usr-field-01');
    `);

    // Cancelled water application (Must be filtered to History tab)
    await db.runAsync(`
      INSERT OR REPLACE INTO water_applications (
        application_id, beneficiary_id, holding_id, project_id, rate_id_snapshot,
        required_litres, calculated_litres, litres_per_acre_snapshot, development_cost_per_litre_snapshot,
        status, application_date, remarks, sync_status, created_by
      ) VALUES (
        'app-wa-103', 'ben-priya-03', 'hld-priya-01', 'prj-csii', 'rate-2026-v1',
        30000.0, 30000.0, 5000.0, 12.50,
        'CANCELLED', datetime('now', '-10 days'), 'Cancelled by applicant due to canal realignment', 'SYNCED', 'usr-field-01'
      );
    `);

    // 8. Seed Pending Sync Queue items for Beneficiary 2 & Application
    await db.runAsync(`
      INSERT OR REPLACE INTO sync_queue (
        id, operation_id, entity_type, entity_id, operation_type, payload, status, attempt_count
      ) VALUES 
        ('sync-01', 'op-ben-02', 'BENEFICIARY', 'ben-mani-02', 'CREATE', '{"beneficiary_id":"ben-mani-02","name":"Mani Kandan"}', 'PENDING', 0),
        ('sync-02', 'op-app-02', 'WATER_APPLICATION', 'app-wa-102', 'CREATE', '{"application_id":"app-wa-102","required_litres":20000}', 'PENDING', 0);
    `);

    // 9. Local Audit Log records
    await db.runAsync(`
      INSERT OR REPLACE INTO local_audit_logs (
        audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp
      ) VALUES 
        ('aud-01', 'usr-field-01', 'FIELD_OFFICER', 'DEV-ANDROID-01', 'BENEFICIARY', 'ben-kanishk-01', 'CREATE', '{"name":"Kanishk R"}', datetime('now', '-5 days')),
        ('aud-02', 'usr-field-01', 'FIELD_OFFICER', 'DEV-ANDROID-01', 'WATER_APPLICATION', 'app-wa-101', 'CREATE', '{"litres":25000}', datetime('now', '-5 days')),
        ('aud-03', 'usr-admin-01', 'ADMIN', 'DEV-ANDROID-01', 'WATER_APPLICATION', 'app-wa-101', 'APPROVE', '{"approved_litres":25000}', datetime('now', '-4 days')),
        ('aud-04', 'usr-field-01', 'FIELD_OFFICER', 'DEV-ANDROID-01', 'PAYMENT', 'pay-101-1', 'RECORD', '{"amount":7812.50,"mode":"CASH"}', datetime('now', '-3 days')),
        ('aud-05', 'usr-field-01', 'FIELD_OFFICER', 'DEV-ANDROID-01', 'BENEFICIARY', 'ben-mani-02', 'CREATE', '{"name":"Mani Kandan"}', datetime('now', '-2 hours')),
        ('aud-06', 'usr-field-01', 'FIELD_OFFICER', 'DEV-ANDROID-01', 'WATER_APPLICATION', 'app-wa-102', 'CREATE', '{"litres":20000}', datetime('now', '-2 hours'));
    `);
  });
}
