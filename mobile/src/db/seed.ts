import * as SQLite from 'expo-sqlite';

export async function seedDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    // 1. Users & Roles
    await db.runAsync(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, is_active, created_at)
      VALUES 
        ('usr-admin-01', 'Admin Officer', 'admin@watergrid.local', 'offline_admin_hash', 'ADMIN', 1, datetime('now', '-30 days')),
        ('usr-field-01', 'Ravi Kumar', 'field@watergrid.local', 'offline_field_hash', 'FIELD_OFFICER', 1, datetime('now', '-30 days')),
        ('usr-acct-01', 'Accounts Manager', 'accounts@watergrid.local', 'offline_acct_hash', 'ACCOUNTS', 1, datetime('now', '-30 days'));
    `);

    // 2. Districts (LGD)
    await db.runAsync(`
      INSERT OR REPLACE INTO districts (district_id, lgd_district_code, name, is_active, created_at)
      VALUES 
        ('dist-cbe', 584, 'Coimbatore', 1, datetime('now', '-30 days')),
        ('dist-tpr', 632, 'Tiruppur', 1, datetime('now', '-30 days'));
    `);

    // 3. Blocks (LGD)
    await db.runAsync(`
      INSERT OR REPLACE INTO blocks (block_id, district_id, lgd_block_code, name, is_active, created_at)
      VALUES 
        ('blk-pol-n', 'dist-cbe', 5421, 'Pollachi North', 1, datetime('now', '-30 days')),
        ('blk-pol-s', 'dist-cbe', 5422, 'Pollachi South', 1, datetime('now', '-30 days')),
        ('blk-sulur', 'dist-cbe', 5425, 'Sulur', 1, datetime('now', '-30 days')),
        ('blk-udm', 'dist-tpr', 5510, 'Udumalpet', 1, datetime('now', '-30 days'));
    `);

    // 4. Panchayats
    await db.runAsync(`
      INSERT OR REPLACE INTO panchayats (panchayat_id, district_id, name, created_at)
      VALUES 
        ('pan-anm', 'dist-cbe', 'Anaimalai Town Panchayat', datetime('now', '-30 days')),
        ('pan-zmn', 'dist-cbe', 'Zamin Uthukuli Village Panchayat', datetime('now', '-30 days')),
        ('pan-vtk', 'dist-cbe', 'Vettaikaranpudur Town Panchayat', datetime('now', '-30 days')),
        ('pan-knt', 'dist-cbe', 'Kinathukadavu Town Panchayat', datetime('now', '-30 days')),
        ('pan-mdt', 'dist-tpr', 'Madathukulam Town Panchayat', datetime('now', '-30 days'));
    `);

    // 5. Villages (LGD)
    await db.runAsync(`
      INSERT OR REPLACE INTO villages (village_id, block_id, panchayat_id, lgd_village_code, name, is_active, created_at)
      VALUES 
        ('vil-anm', 'blk-pol-s', 'pan-anm', 638201, 'Anaimalai', 1, datetime('now', '-30 days')),
        ('vil-zmn', 'blk-pol-n', 'pan-zmn', 638202, 'Zamin Uthukuli', 1, datetime('now', '-30 days')),
        ('vil-vtk', 'blk-pol-s', 'pan-vtk', 638203, 'Vettaikaranpudur', 1, datetime('now', '-30 days')),
        ('vil-knt', 'blk-sulur', 'pan-knt', 638204, 'Kinathukadavu', 1, datetime('now', '-30 days')),
        ('vil-mdt', 'blk-udm', 'pan-mdt', 638205, 'Madathukulam', 1, datetime('now', '-30 days'));
    `);

    // 6. Project Schemes
    await db.runAsync(`
      INSERT OR REPLACE INTO project_schemes (project_id, project_code, project_name, description, status, is_active, created_at)
      VALUES 
        ('prj-csii', 'CSII-2026', 'Coimbatore South Irrigation Initiative', 'Integrated piped irrigation and community distribution system', 'ACTIVE', 1, datetime('now', '-30 days')),
        ('prj-tpr-irr', 'TPR-IRR-2026', 'Tiruppur Basin Water Expansion Scheme', 'Phase 2 agricultural micro-grid distribution', 'ACTIVE', 1, datetime('now', '-30 days'));
    `);

    // 7. Rate Tariffs (Active & Historical)
    await db.runAsync(`
      INSERT OR REPLACE INTO rate_tariffs (rate_id, project_id, litres_per_acre, development_cost_per_litre, running_cost_per_litre, effective_from, is_active, created_by)
      VALUES 
        ('rate-2026-v1', 'prj-csii', 5000.0, 12.50, 3.20, '2026-01-01T00:00:00.000Z', 1, 'usr-admin-01'),
        ('rate-2025-v1', 'prj-csii', 4500.0, 10.00, 2.80, '2025-01-01T00:00:00.000Z', 0, 'usr-admin-01'),
        ('rate-tpr-v1', 'prj-tpr-irr', 6000.0, 14.00, 3.50, '2026-01-01T00:00:00.000Z', 1, 'usr-admin-01');
    `);

    // 8. Beneficiary 1: Kanishk R (Complete Dossier with Land, Water, Bills, Infrastructure, Extensions, Documents)
    await db.runAsync(`
      INSERT OR REPLACE INTO beneficiaries (
        beneficiary_id, name, phone_number, email, address_line1, address_line2, address_line3,
        district_id, block_id, panchayat_id, village_id, pincode, location_direction, location_description,
        status, total_land_acres, sync_status, created_by, created_at
      ) VALUES (
        'ben-kanishk-01', 'Kanishk Ravikumar', '9876543210', 'kanishk@example.com',
        '42 Green Valley Coconut Farm', 'Near Anaimalai Substation', 'Post Box 12',
        'dist-cbe', 'blk-pol-s', 'pan-anm', 'vil-anm', '642104', 'NORTH', 'Bordering canal junction north of milestone 14',
        'ACTIVE', 8.00, 'SYNCED', 'usr-field-01', datetime('now', '-20 days')
      );
    `);

    // Holdings for Kanishk
    // Holding #1 (5.00 acres) -> Approved Water Application + Allotment (25,000 L)
    await db.runAsync(`
      INSERT OR REPLACE INTO land_holdings (
        holding_id, beneficiary_id, project_id, declared_total_area, area_unit, status, is_locked, sync_status, created_by, created_at
      ) VALUES (
        'hld-kanishk-01', 'ben-kanishk-01', 'prj-csii', 5.00, 'ACRES', 'ACTIVE', 1, 'SYNCED', 'usr-field-01', datetime('now', '-20 days')
      );
    `);

    // Parcels for Holding #1: 101/1A (2.50 ac) + 101/1B (2.50 ac) (Valid duplicate survey with distinct subdivision)
    await db.runAsync(`
      INSERT OR REPLACE INTO survey_parcels (
        parcel_id, holding_id, survey_number, subdivision_number, area, area_unit, status, sync_status, created_by, created_at
      ) VALUES 
        ('pcl-01', 'hld-kanishk-01', '101', '1A', 2.50, 'ACRES', 'ACTIVE', 'SYNCED', 'usr-field-01', datetime('now', '-20 days')),
        ('pcl-02', 'hld-kanishk-01', '101', '1B', 2.50, 'ACRES', 'ACTIVE', 'SYNCED', 'usr-field-01', datetime('now', '-20 days'));
    `);

    // Holding #2 (3.00 acres) -> Available & Eligible for new water application
    await db.runAsync(`
      INSERT OR REPLACE INTO land_holdings (
        holding_id, beneficiary_id, project_id, declared_total_area, area_unit, status, is_locked, sync_status, created_by, created_at
      ) VALUES (
        'hld-kanishk-02', 'ben-kanishk-01', 'prj-csii', 3.00, 'ACRES', 'ACTIVE', 0, 'SYNCED', 'usr-field-01', datetime('now', '-20 days')
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO survey_parcels (
        parcel_id, holding_id, survey_number, subdivision_number, area, area_unit, status, sync_status, created_by, created_at
      ) VALUES 
        ('pcl-03', 'hld-kanishk-02', '102', '2', 3.00, 'ACRES', 'ACTIVE', 'SYNCED', 'usr-field-01', datetime('now', '-20 days'));
    `);

    // Water Application for Holding #1 (Approved)
    await db.runAsync(`
      INSERT OR REPLACE INTO water_applications (
        application_id, beneficiary_id, holding_id, project_id, rate_id_snapshot,
        required_litres, calculated_litres, litres_per_acre_snapshot, development_cost_per_litre_snapshot,
        status, application_date, remarks, sync_status, created_by, created_at
      ) VALUES (
        'app-wa-101', 'ben-kanishk-01', 'hld-kanishk-01', 'prj-csii', 'rate-2026-v1',
        25000.0, 25000.0, 5000.0, 12.50,
        'APPROVED', datetime('now', '-18 days'), 'Primary irrigation for coconut orchard', 'SYNCED', 'usr-field-01', datetime('now', '-18 days')
      );
    `);

    // Water Allotment
    await db.runAsync(`
      INSERT OR REPLACE INTO water_allotments (
        allotment_id, application_id, beneficiary_id, holding_id, rate_id,
        total_land_acres_snapshot, litres_per_acre_snapshot, calculated_allotted_litres, approved_litres,
        approval_status, approved_by, approved_at, approval_remarks, is_active, sync_status, created_by, created_at
      ) VALUES (
        'alt-101', 'app-wa-101', 'ben-kanishk-01', 'hld-kanishk-01', 'rate-2026-v1',
        5.00, 5000.0, 25000.0, 25000.0,
        'APPROVED', 'usr-admin-01', datetime('now', '-17 days'), 'Technical survey cleared by field engineer', 1, 'SYNCED', 'usr-admin-01', datetime('now', '-17 days')
      );
    `);

    // Development Bill: 25,000 L * ₹12.50 = ₹3,12,500
    await db.runAsync(`
      INSERT OR REPLACE INTO development_bills (
        bill_id, beneficiary_id, allotment_id, approved_litres_snapshot,
        development_cost_per_litre_snapshot, total_amount, amount_paid, pending_amount,
        status, sync_status, created_by, created_at
      ) VALUES (
        'bill-101', 'ben-kanishk-01', 'alt-101', 25000.0,
        12.50, 312500.00, 70312.50, 242187.50,
        'PARTIALLY_PAID', 'SYNCED', 'usr-admin-01', datetime('now', '-17 days')
      );
    `);

    // 5-Stage Installments
    await db.runAsync(`
      INSERT OR REPLACE INTO installments (
        installment_id, bill_id, installment_number, percentage, amount_due, amount_paid, pending_amount, due_date, status, milestone_name, sync_status
      ) VALUES 
        ('inst-101-1', 'bill-101', 1, 2.5, 7812.50, 7812.50, 0.00, date('now', '-10 days'), 'PAID', 'Initial Administrative Fee', 'SYNCED'),
        ('inst-101-2', 'bill-101', 2, 20.0, 62500.00, 62500.00, 0.00, date('now', '+15 days'), 'PAID', 'Pipeline Excavation & Laying', 'SYNCED'),
        ('inst-101-3', 'bill-101', 3, 25.0, 78125.00, 0.00, 78125.00, date('now', '+60 days'), 'PENDING', 'Main Storage Delivery', 'SYNCED'),
        ('inst-101-4', 'bill-101', 4, 25.0, 78125.00, 0.00, 78125.00, date('now', '+105 days'), 'PENDING', 'Distribution Valves Installation', 'SYNCED'),
        ('inst-101-5', 'bill-101', 5, 27.5, 85937.50, 0.00, 85937.50, date('now', '+150 days'), 'PENDING', 'Final Commissioning & Water Release', 'SYNCED');
    `);

    // Payments for Stage 1 & Stage 2
    await db.runAsync(`
      INSERT OR REPLACE INTO payments (
        payment_id, beneficiary_id, bill_id, installment_id, receipt_number, amount,
        payment_mode, payment_reference, payment_date, status, is_reversal, recorded_by, sync_status, created_at
      ) VALUES 
        ('pay-101-1', 'ben-kanishk-01', 'bill-101', 'inst-101-1', 'RCP-2026-00101', 7812.50, 'BANK_TRANSFER', 'NEFT-AXIS-9921', datetime('now', '-15 days'), 'COMPLETED', 0, 'usr-field-01', 'SYNCED', datetime('now', '-15 days')),
        ('pay-101-2', 'ben-kanishk-01', 'bill-101', 'inst-101-2', 'RCP-2026-00102', 62500.00, 'CHEQUE', 'CHQ-882104', datetime('now', '-8 days'), 'COMPLETED', 0, 'usr-field-01', 'SYNCED', datetime('now', '-8 days'));
    `);

    // Running Bill for Q1: 25,000 L * ₹3.20 = ₹80,000
    await db.runAsync(`
      INSERT OR REPLACE INTO running_bills (
        running_bill_id, allotment_id, beneficiary_id, rate_id, billing_period,
        approved_litres_snapshot, running_cost_per_litre_snapshot, amount_due, amount_paid, pending_amount,
        status, sync_status, created_by, created_at
      ) VALUES (
        'rb-101-q1', 'alt-101', 'ben-kanishk-01', 'rate-2026-v1', '2026-Q1',
        25000.0, 3.20, 80000.00, 0.00, 80000.00,
        'PENDING', 'SYNCED', 'usr-admin-01', datetime('now', '-5 days')
      );
    `);

    // Infrastructure Record for Allotment 101
    await db.runAsync(`
      INSERT OR REPLACE INTO infrastructure (
        infrastructure_id, allotment_id, beneficiary_id, status,
        planned_date, construction_start_date, completion_date, commissioned_date, remarks, sync_status, created_by, created_at
      ) VALUES (
        'infra-101', 'alt-101', 'ben-kanishk-01', 'COMMISSIONED',
        date('now', '-16 days'), date('now', '-12 days'), date('now', '-4 days'), date('now', '-2 days'),
        '4-inch high pressure distribution line with automatic pressure release valve', 'SYNCED', 'usr-admin-01', datetime('now', '-16 days')
      );
    `);

    // Extension Request for Allotment 101
    await db.runAsync(`
      INSERT OR REPLACE INTO extensions (
        extension_id, beneficiary_id, original_allotment_id, requested_additional_area, requested_additional_litres,
        approved_additional_area, approved_additional_litres, rate_id, additional_development_cost_per_litre,
        extension_cost, status, requested_at, approved_by, approved_at, remarks, sync_status, created_by, created_at
      ) VALUES (
        'ext-101-1', 'ben-kanishk-01', 'alt-101', 2.00, 10000.0,
        2.00, 10000.0, 'rate-2026-v1', 12.50,
        125000.00, 'APPROVED', datetime('now', '-3 days'), 'usr-admin-01', datetime('now', '-1 day'),
        'Additional 2 acres drip line connection to northern boundary', 'SYNCED', 'usr-field-01', datetime('now', '-3 days')
      );
    `);

    // Documents for Kanishk
    await db.runAsync(`
      INSERT OR REPLACE INTO beneficiary_documents (
        document_id, beneficiary_id, category, title, file_name, file_size_bytes, mime_type, storage_path, reference_id, sync_status, created_at
      ) VALUES 
        ('doc-01', 'ben-kanishk-01', 'LAND_RECORD', 'Patta Passbook - Survey 101/1A & 1B', 'patta_kanishk_101.pdf', 1048576, 'application/pdf', 'local_docs/patta_101.pdf', 'hld-kanishk-01', 'SYNCED', datetime('now', '-20 days')),
        ('doc-02', 'ben-kanishk-01', 'APPROVAL_LETTER', 'Water Allocation Clearance Certificate', 'approval_wa_101.pdf', 524288, 'application/pdf', 'local_docs/approval_101.pdf', 'app-wa-101', 'SYNCED', datetime('now', '-17 days')),
        ('doc-03', 'ben-kanishk-01', 'PAYMENT_RECEIPT', 'Receipt for Stage 1 & 2 Development Installments', 'receipt_stage1_2.pdf', 262144, 'application/pdf', 'local_docs/receipt_101.pdf', 'bill-101', 'SYNCED', datetime('now', '-8 days'));
    `);

    // 9. Beneficiary 2: Mani Kandan (In-progress offline workflow)
    await db.runAsync(`
      INSERT OR REPLACE INTO beneficiaries (
        beneficiary_id, name, phone_number, email, address_line1, address_line2,
        district_id, block_id, panchayat_id, village_id, pincode, location_direction, location_description,
        status, total_land_acres, sync_status, created_by, created_at
      ) VALUES (
        'ben-mani-02', 'Mani Kandan', '9443322110', 'mani@example.com',
        '12 North Street', 'Opposite Mariamman Temple',
        'dist-cbe', 'blk-pol-n', 'pan-zmn', 'vil-zmn', '642004', 'EAST', 'Adjacent to village common well',
        'ACTIVE', 4.00, 'PENDING_SYNC', 'usr-field-01', datetime('now', '-2 hours')
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO land_holdings (
        holding_id, beneficiary_id, project_id, declared_total_area, area_unit, status, is_locked, sync_status, created_by, created_at
      ) VALUES (
        'hld-mani-01', 'ben-mani-02', 'prj-csii', 4.00, 'ACRES', 'ACTIVE', 0, 'PENDING_SYNC', 'usr-field-01', datetime('now', '-2 hours')
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO survey_parcels (
        parcel_id, holding_id, survey_number, subdivision_number, area, area_unit, status, sync_status, created_by, created_at
      ) VALUES 
        ('pcl-mani-01', 'hld-mani-01', '205', '3A', 4.00, 'ACRES', 'ACTIVE', 'PENDING_SYNC', 'usr-field-01', datetime('now', '-2 hours'));
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO water_applications (
        application_id, beneficiary_id, holding_id, project_id, rate_id_snapshot,
        required_litres, calculated_litres, litres_per_acre_snapshot, development_cost_per_litre_snapshot,
        status, application_date, remarks, sync_status, created_by, created_at
      ) VALUES (
        'app-wa-102', 'ben-mani-02', 'hld-mani-01', 'prj-csii', 'rate-2026-v1',
        20000.0, 20000.0, 5000.0, 12.50,
        'SUBMITTED', datetime('now', '-2 hours'), 'Applied in field via offline mobile client', 'PENDING_SYNC', 'usr-field-01', datetime('now', '-2 hours')
      );
    `);

    // 10. Beneficiary 3: Priya Shanmugam (Demonstrating Historical Cancelled App + Reapplication Eligibility)
    await db.runAsync(`
      INSERT OR REPLACE INTO beneficiaries (
        beneficiary_id, name, phone_number, email, address_line1, address_line2,
        district_id, block_id, panchayat_id, village_id, pincode, location_direction, location_description,
        status, total_land_acres, sync_status, created_by, created_at
      ) VALUES (
        'ben-priya-03', 'Priya Shanmugam', '9789012345', 'priya@example.com',
        '7 Coconut Grove', 'Canal Road',
        'dist-tpr', 'blk-udm', 'pan-mdt', 'vil-mdt', '642126', 'SOUTH', 'Near southern canal distributary',
        'ACTIVE', 6.00, 'SYNCED', 'usr-field-01', datetime('now', '-25 days')
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO land_holdings (
        holding_id, beneficiary_id, project_id, declared_total_area, area_unit, status, is_locked, sync_status, created_by, created_at
      ) VALUES (
        'hld-priya-01', 'ben-priya-03', 'prj-csii', 6.00, 'ACRES', 'ACTIVE', 0, 'SYNCED', 'usr-field-01', datetime('now', '-25 days')
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO survey_parcels (
        parcel_id, holding_id, survey_number, subdivision_number, area, area_unit, status, sync_status, created_by, created_at
      ) VALUES 
        ('pcl-priya-01', 'hld-priya-01', '310', '1', 6.00, 'ACRES', 'ACTIVE', 'SYNCED', 'usr-field-01', datetime('now', '-25 days'));
    `);

    // Cancelled Historical Application (Must appear in History, does NOT block new application)
    await db.runAsync(`
      INSERT OR REPLACE INTO water_applications (
        application_id, beneficiary_id, holding_id, project_id, rate_id_snapshot,
        required_litres, calculated_litres, litres_per_acre_snapshot, development_cost_per_litre_snapshot,
        status, application_date, remarks, sync_status, created_by, created_at
      ) VALUES (
        'app-wa-103', 'ben-priya-03', 'hld-priya-01', 'prj-csii', 'rate-2026-v1',
        30000.0, 30000.0, 5000.0, 12.50,
        'CANCELLED', datetime('now', '-12 days'), 'Cancelled by applicant due to private borewell depth revision', 'SYNCED', 'usr-field-01', datetime('now', '-12 days')
      );
    `);

    // 11. Beneficiary 4: Suresh Kumar (Demonstrating Rejected Historical App)
    await db.runAsync(`
      INSERT OR REPLACE INTO beneficiaries (
        beneficiary_id, name, phone_number, email, address_line1, address_line2,
        district_id, block_id, panchayat_id, village_id, pincode, location_direction, location_description,
        status, total_land_acres, sync_status, created_by, created_at
      ) VALUES (
        'ben-suresh-04', 'Suresh Kumar', '9842112233', 'suresh@example.com',
        '18 Canal Bank Road', 'Near Sulur Tank',
        'dist-cbe', 'blk-sulur', 'pan-knt', 'vil-knt', '641402', 'WEST', 'Behind Sulur feeder channel',
        'ACTIVE', 3.50, 'SYNCED', 'usr-field-01', datetime('now', '-15 days')
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO land_holdings (
        holding_id, beneficiary_id, project_id, declared_total_area, area_unit, status, is_locked, sync_status, created_by, created_at
      ) VALUES (
        'hld-suresh-01', 'ben-suresh-04', 'prj-csii', 3.50, 'ACRES', 'ACTIVE', 0, 'SYNCED', 'usr-field-01', datetime('now', '-15 days')
      );
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO survey_parcels (
        parcel_id, holding_id, survey_number, subdivision_number, area, area_unit, status, sync_status, created_by, created_at
      ) VALUES 
        ('pcl-suresh-01', 'hld-suresh-01', '405', '2B', 3.50, 'ACRES', 'ACTIVE', 'SYNCED', 'usr-field-01', datetime('now', '-15 days'));
    `);

    await db.runAsync(`
      INSERT OR REPLACE INTO water_applications (
        application_id, beneficiary_id, holding_id, project_id, rate_id_snapshot,
        required_litres, calculated_litres, litres_per_acre_snapshot, development_cost_per_litre_snapshot,
        status, application_date, remarks, sync_status, created_by, created_at
      ) VALUES (
        'app-wa-104', 'ben-suresh-04', 'hld-suresh-01', 'prj-csii', 'rate-2026-v1',
        17500.0, 17500.0, 5000.0, 12.50,
        'REJECTED', datetime('now', '-14 days'), 'Boundary overlap with railway easement buffer', 'SYNCED', 'usr-admin-01', datetime('now', '-14 days')
      );
    `);

    // 12. Sync Queue Items
    await db.runAsync(`
      INSERT OR REPLACE INTO sync_queue (
        id, operation_id, entity_type, entity_id, operation_type, payload, status, attempt_count
      ) VALUES 
        ('sq-01', 'op-ben-02', 'BENEFICIARY', 'ben-mani-02', 'CREATE', '{"beneficiary_id":"ben-mani-02","name":"Mani Kandan"}', 'PENDING', 0),
        ('sq-02', 'op-hld-02', 'LAND_HOLDING', 'hld-mani-01', 'CREATE', '{"holding_id":"hld-mani-01","acres":4.0}', 'PENDING', 0),
        ('sq-03', 'op-app-02', 'WATER_APPLICATION', 'app-wa-102', 'CREATE', '{"application_id":"app-wa-102","required_litres":20000}', 'PENDING', 0);
    `);

    // 13. Audit Log Entries
    await db.runAsync(`
      INSERT OR REPLACE INTO local_audit_logs (
        audit_id, user_id, user_role, device_id, entity_type, entity_id, action, details_json, timestamp
      ) VALUES 
        ('aud-01', 'usr-field-01', 'FIELD_OFFICER', 'MOBILE-DEVICE-ARM64', 'BENEFICIARY', 'ben-kanishk-01', 'CREATE', '{"name":"Kanishk Ravikumar"}', datetime('now', '-20 days')),
        ('aud-02', 'usr-field-01', 'FIELD_OFFICER', 'MOBILE-DEVICE-ARM64', 'WATER_APPLICATION', 'app-wa-101', 'SUBMIT', '{"litres":25000}', datetime('now', '-18 days')),
        ('aud-03', 'usr-admin-01', 'ADMIN', 'MOBILE-DEVICE-ARM64', 'WATER_APPLICATION', 'app-wa-101', 'APPROVE', '{"approved_litres":25000}', datetime('now', '-17 days')),
        ('aud-04', 'usr-field-01', 'FIELD_OFFICER', 'MOBILE-DEVICE-ARM64', 'PAYMENT', 'pay-101-1', 'PAYMENT_RECORDED', '{"amount":7812.50,"mode":"BANK_TRANSFER"}', datetime('now', '-15 days')),
        ('aud-05', 'usr-field-01', 'FIELD_OFFICER', 'MOBILE-DEVICE-ARM64', 'PAYMENT', 'pay-101-2', 'PAYMENT_RECORDED', '{"amount":62500.00,"mode":"CHEQUE"}', datetime('now', '-8 days')),
        ('aud-06', 'usr-admin-01', 'ADMIN', 'MOBILE-DEVICE-ARM64', 'INFRASTRUCTURE', 'infra-101', 'INFRASTRUCTURE_STATUS_CHANGED', '{"status":"COMMISSIONED"}', datetime('now', '-2 days')),
        ('aud-07', 'usr-admin-01', 'ADMIN', 'MOBILE-DEVICE-ARM64', 'EXTENSION', 'ext-101-1', 'EXTENSION_APPROVED', '{"approved_litres":10000}', datetime('now', '-1 day')),
        ('aud-08', 'usr-field-01', 'FIELD_OFFICER', 'MOBILE-DEVICE-ARM64', 'BENEFICIARY', 'ben-mani-02', 'CREATE', '{"name":"Mani Kandan"}', datetime('now', '-2 hours'));
    `);
  });
}
