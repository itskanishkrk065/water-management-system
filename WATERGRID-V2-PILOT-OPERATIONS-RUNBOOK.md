# WATERGRID V2 — PILOT OPERATIONS RUNBOOK
**Authoritative Operational Runbook for the Controlled 5-Device Field Pilot**

---

## 1. PILOT OVERVIEW & DEVICE REGISTRY

The WaterGrid V2 Controlled Field Pilot deploys 5 designated field laptop nodes across Tiruppur and Coimbatore districts to validate real-world offline field workflows, synchronization, and financial stability.

### Pilot Device Manifest
| Device ID | Assigned Operator | Role | Assigned Geographic Scope | App Version | Local DB Engine |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DEV-PILOT-001` | S. Arumugam | Field Officer | Tiruppur / Avinashi (4 Villages) | `v2.0.0-pilot` | SQLite 3.45 (WAL) |
| `DEV-PILOT-002` | K. Selvi | Field Officer | Tiruppur / Palladam (5 Villages) | `v2.0.0-pilot` | SQLite 3.45 (WAL) |
| `DEV-PILOT-003` | M. Rajendran | Collection Agent | Coimbatore / Sulur (6 Villages) | `v2.0.0-pilot` | SQLite 3.45 (WAL) |
| `DEV-PILOT-004` | P. Karthik | Collection Agent | Coimbatore / Pollachi (4 Villages) | `v2.0.0-pilot` | SQLite 3.45 (WAL) |
| `DEV-PILOT-005` | V. Sundaram | Accounts Officer | Central HQ / Reconciliation | `v2.0.0-pilot` | PostgreSQL 16 Client |

---

## 2. CLIENT OPERATIONAL STATES & STATUS INDICATORS

Field operators must understand the visual sync status banner displayed in the application header:

```
┌────────────────────────────────────────────────────────────────────────┐
│  🟢 ONLINE              Central server connected; real-time sync active │
├────────────────────────────────────────────────────────────────────────┤
│  🟠 OFFLINE             Operating strictly on local SQLite cache       │
├────────────────────────────────────────────────────────────────────────┤
│  🔵 SYNCING             Uploading outbox envelopes and pulling deltas   │
├────────────────────────────────────────────────────────────────────────┤
│  🔴 ATTENTION REQUIRED  Conflicts exist or permanently failed operations│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. FIELD OPERATOR DAILY STANDARD OPERATING PROCEDURE (SOP)

### Phase A: Before Departing for the Field (At District Office)
1. **Device Readiness**: Ensure laptop battery is 100% charged and carry 12V vehicle charging adapter.
2. **Pre-Flight Synchronization**:
   * Connect to office Wi-Fi.
   * Open WaterGrid Desktop.
   * Verify status turns **ONLINE 🟢**.
   * Verify `Sync Outbox Depth` is **0**.
   * Click `Sync Center -> Pull Latest Master Data` to ensure all latest tariff configurations and beneficiary records are cached locally.
3. **Safety Backup**:
   * Navigate to `Settings -> System Diagnostics`.
   * Click `Create Offline Backup`.
   * Verify confirmation: `Backup WaterManagement_Backup_<DATE>.wmbak created successfully`.

### Phase B: During Field Work (Offline in Village)
1. **Offline Mode Operation**:
   * Application transitions automatically to **OFFLINE 🟠**.
   * Field officers can register new beneficiaries, add land holdings, record water usage, and collect payments.
2. **Receipt Issuance Protocols**:
   * All receipts generated offline display the mandatory watermark:
     `[OFFLINE RECEIPT — PENDING CENTRAL CONFIRMATION]`.
   * Explain to the beneficiary that their payment is recorded on the officer's device and will be confirmed on the state ledger upon evening sync.
3. **No Network Churning**:
   * Do not tether erratic cellular 2G hotspots in deep rural areas. Allow WaterGrid to remain offline; mutations are safely held in SQLite WAL.

### Phase C: After Returning from Field (At Office / Stable Network)
1. **Reconnection**:
   * Connect laptop to stable broadband.
   * Status indicator changes to **SYNCING 🔵**.
2. **Outbox Drain Verification**:
   * Watch the outbox counter decrement to **0**.
   * Once complete, status indicator turns **ONLINE 🟢**.
3. **Attention Required Resolution**:
   * If status indicator turns **ATTENTION REQUIRED 🔴**:
     * Open `Sync Center -> Active Conflicts`.
     * Inspect any version mismatch or concurrent update.
     * Click `Accept Server` or `Merge Changes` according to standard business rules.
4. **Receipt Confirmation**:
   * The offline receipts automatically re-index to `[VERIFIED ON CENTRAL LEDGER]`.

---

## 4. FIELD INCIDENT RESPONSE & EMERGENCY PROCEDURES

### Scenario 1: Device Stolen or Lost in Transit
1. **Immediate Action**: Operator calls Central HQ Hotline within 15 minutes.
2. **Central Admin Action**:
   * HQ Administrator opens `Admin -> Sync Center -> Device Security`.
   * Selects lost Device ID (e.g. `DEV-PILOT-001`).
   * Clicks `Revoke Hardware Device` and enters reason: `Device reported lost in field`.
3. **Result**: Central PostgreSQL sets `is_active = false`. The thief cannot push fraudulent data or decrypt cached tokens (tokens are encrypted in DPAPI/Keychain).

### Scenario 2: Laptop Battery Dies Mid-Transaction
1. Connect laptop to power and reboot.
2. Start WaterGrid Desktop.
3. SQLite WAL guarantees transactional atomicity:
   * If transaction was partially entered, it rolls back cleanly.
   * If transaction committed locally, it resides in `sync_outbox` ready for synchronization.
4. Check `Sync Center -> Outbox Inspector` to verify the last transaction was saved.

### Scenario 3: Beneficiary Disputes Offline Balance
* Show the beneficiary the local transaction ledger on the device.
* Verify whether the receipt was generated from this device or a different collection agent.
* If collected by another agent, inform the beneficiary that their balance will update during the evening batch sync.
