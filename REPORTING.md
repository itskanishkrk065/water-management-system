# Advanced Find, Filter & Reporting Specification

## 1. Executive Summary & Core Concept

The **Water Management System Find, Filter & Reporting Page** (`/admin/find` and `/reports/find`) is a centralized reporting and query engine for administrators, finance officers, and field operations staff.

Unlike standard paginated tables that perform client-side filtering, this system executes dynamic multi-entity queries and **decimal-safe whole-population aggregations directly within PostgreSQL**.

```
User selects multi-entity filters
               │
               ▼
   FindFilterDto (Validated)
               │
               ▼
       FindFilterService
 (Single Source of Truth Where Builder)
               │
       ┌───────┴───────┐
       ▼               ▼
PostgreSQL Query  Aggregation Loop
(Paginated Items) (Entire Population)
       │               │
       └───────┬───────┘
               ▼
  Synchronized Response:
   • Filtered Records
   • Real-Time Population KPIs
   • Authoritative PDF Export
```

---

## 2. Metric Definitions & Aggregation Rules

Every metric displayed on the screen and exported in the PDF is computed over the **exact filtered dataset** (never just the current page), using decimal-safe backend arithmetic to eliminate floating-point precision errors.

### 2.1 Beneficiary Population Metrics
| Metric | Description | Computation Method |
| :--- | :--- | :--- |
| **Total Beneficiaries** | Count of unique beneficiaries matching all active filter criteria. | `COUNT(DISTINCT beneficiary_id)` across matching records. |
| **Active Beneficiaries** | Number of matching beneficiaries with status `ACTIVE`. | Count of matched records where `status = 'ACTIVE'`. |
| **Inactive Beneficiaries** | Number of matching beneficiaries with status `INACTIVE`. | Count of matched records where `status = 'INACTIVE'`. |

### 2.2 Cadastral Land Metrics
| Metric | Description | Computation Method |
| :--- | :--- | :--- |
| **Total Active Land Area** | Cumulative acreage of active cadastral land holdings owned by matched beneficiaries. | $\sum \text{declared\_total\_area}$ for all active holdings belonging to matched beneficiaries. |
| **Total Land Holdings** | Number of distinct registered land holding records. | Count of active holding documents across matched beneficiaries. |
| **Total Cadastral Parcels** | Total number of individual SF/Subdivision parcels. | $\sum \text{parcels.length}$ across all active land holdings. |

### 2.3 Water Allocation Metrics
| Metric | Description | Computation Method |
| :--- | :--- | :--- |
| **Total Required Water** | Sum of requested irrigation liters from matching water applications. | $\sum \text{required\_litres}$ from latest applications of matching beneficiaries. |
| **Total Calculated Allotment** | Algorithmic allotment computed based on acreage and crop tariff rules. | $\sum \text{calculated\_allotted\_litres}$ from allotments of matching beneficiaries. |
| **Total Approved Water** | Official legally approved allocation of water liters. | $\sum \text{approved\_litres}$ from active approved allotments. |

### 2.4 Financial & Development Cost Metrics
| Metric | Description | Computation Method |
| :--- | :--- | :--- |
| **Total Development Cost** | Aggregate capital development charges assessed to matching beneficiaries. | $\sum \text{total\_amount}$ across development bills of matching beneficiaries. |
| **Total Amount Due** | Total billable amount due across matching development bills. | $\sum \text{total\_amount}$ for active development bills. |
| **Total Amount Paid** | Cumulative valid recorded payments received and settled. | $\sum \text{amount\_paid}$ from valid development bills. |
| **Total Pending Balance** | Outstanding capital recovery balance. | $\sum \text{pending\_amount} = \text{Total Amount Due} - \text{Total Amount Paid}$. |

### 2.5 Beneficiary Payment State Distribution
Counts the number of **unique beneficiaries** in each distinct financial status:
* **Paid Beneficiaries**: Beneficiaries whose development bills are fully settled (`status = 'PAID'`).
* **Partially Paid Beneficiaries**: Beneficiaries who have paid one or more installments but retain a pending balance (`status = 'PARTIALLY_PAID'`).
* **Unpaid Beneficiaries**: Beneficiaries who have a generated bill with 0 payments recorded (`status = 'PENDING'` and `amount_paid = 0`).
* **Overdue Beneficiaries**: Beneficiaries who have at least one installment past its `due_date` with `status = 'OVERDUE'`.

### 2.6 5-Stage Installment Recovery Metrics
| Metric | Description | Computation Method |
| :--- | :--- | :--- |
| **Total Installments** | Total number of installment milestone stages generated across matched population. | Count of installment records ($5 \times \text{matched bills}$). |
| **Paid Installments** | Number of installment stages with status `PAID`. | Count of installments where `status = 'PAID'`. |
| **Partially Paid Installments** | Number of installment stages with partial payments. | Count of installments where `status = 'PARTIALLY_PAID'`. |
| **Pending Installments** | Installment stages awaiting future due dates. | Count of installments where `status = 'PENDING'`. |
| **Overdue Installments** | Installment stages past due date without full payment. | Count of installments where `status = 'OVERDUE'`. |
| **Installment Amount Due / Paid / Pending** | Monetary sums across all matching installment milestones. | $\sum \text{amount\_due}$, $\sum \text{amount\_paid}$, and $\sum \text{pending\_amount}$. |

### 2.7 Physical Infrastructure Grid Metrics
| Metric | Description |
| :--- | :--- |
| **Planned** | Physical connection grid planned but civil work not started (`status = 'PLANNED'`). |
| **Under Construction** | Pipe laying, trenching, or valve chamber installation underway (`status = 'UNDER_CONSTRUCTION'`). |
| **Completed** | Construction and hydrostatic pressure testing completed (`status = 'COMPLETED'`). |
| **Commissioned** | Live water delivery flow initiated and certified (`status = 'COMMISSIONED'`). |

### 2.8 Quota Extension Metrics
| Metric | Description |
| :--- | :--- |
| **Total Requests** | Total volume of supplementary water quota applications submitted. |
| **Approved / Rejected / Pending** | Status counts for quota extension requests. |
| **Additional Litres Requested** | Cumulative supplementary liters requested ($\sum \text{additional\_litres}$). |
| **Additional Litres Approved** | Cumulative approved supplementary liters ($\sum \text{approved\_litres}$). |

---

## 3. Anti-Join Inflation & Single Source of Truth

In relational schemas with $1:N$ relationships (Beneficiary $\to$ $N$ Land Parcels, Beneficiary $\to$ $5$ Installments, Beneficiary $\to$ $N$ Payments), naive SQL joins result in cartesian multiplication.

To ensure 100% data integrity:
1. `FindFilterService.buildBeneficiaryWhere(dto)` builds a single, authoritative Prisma where condition.
2. Population aggregations loop across distinct beneficiaries and aggregate child collections independently without row duplication.
3. The exact same filter condition is reused across:
   - Paginated record list queries
   - Whole-population metric aggregations
   - Authoritative server-side PDF exports

---

## 4. Historical Snapshot Preservation Rule

When calculating and reporting historical financial metrics:
* Calculations **must use the snapshotted values** stored at the time of allotment/billing (`approved_litres`, `development_cost_per_litre_snapshot`, `total_amount`).
* Historical bills **are never recalculated** against subsequent tariff rate changes.

$$\text{Development Bill} = \text{Historical Snapshot Liters} \times \text{Historical Snapshot Rate}$$

---

## 5. Server-Side PDF Export Architecture

The PDF report is generated exclusively server-side via `pdfkit` and streamed with official metadata:
* **Orientation**: Landscape A4 with custom header blocks and data table.
* **Applied Filter Metadata**: Explicitly lists active filters or "All Records" on the title banner.
* **KPI Metrics Summary Cards**: Mirrors the on-screen population metrics.
* **Multi-Page Pagination**: Includes repeating table headers, alternating row striping, page numbers (`Page X of Y`), and confidential official documentation stamps.
* **Audit Trail**: Every export triggers a `REPORT_EXPORTED` audit log entry with `filterCriteria`, `recordCount`, `userId`, and `timestamp`.

---

## 6. RBAC & Security Matrix

| Role | Query & Filters (`POST /reports/find`) | Metadata (`GET /reports/find/metadata`) | PDF Export (`POST /reports/find/export/pdf`) |
| :--- | :---: | :---: | :---: |
| **ADMIN** | ✅ Full Access | ✅ Allowed | ✅ Full Access |
| **FIELD_OFFICER** | ✅ Full Access | ✅ Allowed | ✅ Full Access |
| **ACCOUNTS** | ✅ Full Access | ✅ Allowed | ✅ Full Access |
| **VIEWER** | ✅ Read-Only Query | ✅ Allowed | ❌ Forbidden (403) |
| **BENEFICIARY** | ❌ Forbidden (403) | ❌ Forbidden (403) | ❌ Forbidden (403) |
