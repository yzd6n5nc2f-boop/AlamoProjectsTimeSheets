# Timesheet Payroll Export Specification (CSV/Excel)

Product: **Timesheet**  
Subtitle: **for Alamo Projects**

This specification defines deterministic payroll export output for CSV and Excel.

## 1) Export Spec

### 1.1 Export artifacts per batch

For each generated batch:

1. `payroll_<batch_id>_summary.csv`
2. `payroll_<batch_id>_lines.csv`
3. `payroll_<batch_id>_exceptions.csv` (includes blocked and warning rows)
4. `payroll_<batch_id>.xlsx` workbook with sheets:
  - `Summary`
  - `Lines`
  - `Exceptions`

Notes:
- `Summary` is employee-period rollup.
- `Lines` is normalized earnings output (supports leave by code cleanly).
- `Exceptions` is traceability output for data quality flags.
- Excel output footer on each printed sheet: `Innoweb Ventures Limited`.

### 1.2 Column mapping: Summary (employee-period totals)

| Output column | Type | Source mapping | Rule |
|---|---|---|---|
| `batch_id` | text | `payroll_export_batch.batch_id` | Same for all rows in batch |
| `batch_generated_at_utc` | timestamp | `payroll_export_batch.generated_at` | UTC ISO-8601 |
| `export_contract_version` | text | constant | `timesheet-payroll-v1` |
| `rule_set_id` | bigint | `timesheet_header.rule_set_id` | Pinned at timesheet level |
| `employee_number` | text | `employee.employee_number` | Unique employee key |
| `employee_name` | text | `employee.first_name + last_name` | Human-readable |
| `period_start` | date | `timesheet_period.period_start` | |
| `period_end` | date | `timesheet_period.period_end` | |
| `workflow_status` | text | `timesheet_header.workflow_status` | Expected `PAYROLL_VALIDATED` |
| `normal_hours` | numeric(8,2) | `sum(timesheet_day_entry.normal_minutes)/60` | Rounded 2 dp |
| `overtime_hours` | numeric(8,2) | `sum(timesheet_day_entry.ot_minutes)/60` | Rounded 2 dp |
| `public_holiday_worked_hours` | numeric(8,2) | `sum(timesheet_day_entry.ph_worked_minutes)/60` | Rounded 2 dp |
| `leave_total_hours` | numeric(8,2) | `sum(timesheet_day_entry.leave_minutes)/60` | Rounded 2 dp |
| `gross_paid_hours` | numeric(8,2) | normal + overtime + ph worked + leave | Rounded 2 dp |
| `flag_missing_approvals` | boolean | derived | `true` if manager/payroll transition chain incomplete |
| `flag_missing_days` | boolean | derived | `true` if required period dates lack row coverage |
| `flag_abnormal_totals` | boolean | derived | `true` if totals breach abnormal threshold policy |
| `exception_codes` | text | from `timesheet_exception.rule_code` | `;` separated sorted codes |
| `export_ready` | boolean | derived | `true` only if blocking flags false |

### 1.3 Column mapping: Lines (normalized earnings/leave by code)

One or more rows per employee-period.

| Output column | Type | Source mapping | Rule |
|---|---|---|---|
| `batch_id` | text | `payroll_export_batch.batch_id` | |
| `line_no` | int | `payroll_export_line.line_no` | Stable deterministic ordering |
| `employee_number` | text | `employee.employee_number` | |
| `period_start` | date | `timesheet_period.period_start` | |
| `period_end` | date | `timesheet_period.period_end` | |
| `earning_code` | text | `payroll_export_line.earnings_code` | `NORMAL`, `OT`, `PH_WORKED`, leave earning code |
| `leave_code` | text nullable | leave code when leave line | null for non-leave lines |
| `line_type` | text | derived | `EARNING` or `LEAVE` |
| `normal_hours` | numeric(8,2) | `normal_minutes/60` | For `NORMAL` line |
| `overtime_hours` | numeric(8,2) | `ot_minutes/60` | For `OT` line |
| `public_holiday_worked_hours` | numeric(8,2) | `ph_worked_minutes/60` | For `PH_WORKED` line |
| `leave_hours` | numeric(8,2) | `leave_minutes/60` | For leave lines |
| `project_code` | text nullable | allocation mapping | null in MVP if not allocated |
| `cost_code` | text nullable | allocation mapping | null in MVP if not allocated |
| `is_paid` | boolean | from leave/policy mapping | true/false |

Leave by type/code behavior:
- Each leave code exports as its own line (`leave_code`, `earning_code`, `leave_hours`).
- This avoids dynamic column explosion and remains stable when leave codes are configured.

### 1.4 Exception flags and readiness rules

Flags are computed per employee-period:

- `flag_missing_approvals`:
  - true when not transitioned through required approvals before export.
- `flag_missing_days`:
  - true when expected workdays have no row coverage and no valid absence row.
- `flag_abnormal_totals`:
  - true when totals exceed configured anomaly thresholds (for example, > 80 paid hours/week).

Blocking policy:
- `missing_approvals`: blocking
- `missing_days`: blocking
- `abnormal_totals`: warning by default (configurable to blocking)

`export_ready = NOT(blocking_flags_present)`

### 1.5 Reproducibility and versioning rules

Deterministic output requirements:

1. Same inputs produce identical lines and hashes.
2. Canonical ordering:
  - employee_number ASC
  - earning/leave code ASC
  - line_type ASC
3. Canonical rounding and units:
  - base compute in minutes
  - export in hours with fixed 2-decimal rounding
4. Pinned rule context:
  - use `timesheet_header.rule_set_id` and stored computed minutes
  - do not recompute historical locked records with new rules
5. Hashing:
  - `checksum_sha256` is SHA-256 of canonical serialized output rows
6. Version fields:
  - `export_contract_version` (format contract, e.g. `timesheet-payroll-v1`)
  - `rule_set_id` (policy context)
  - generator build version (recommended in metadata/audit)

Repeatability rule:
- If same period + same canonical data hash is requested, return existing batch metadata instead of creating a duplicate batch.

## 2) Batch Entity + Audit Linkage

### 2.1 Batch ID generation and storage

Recommended deterministic format:

`TS-{period_start_yyyymmdd}-{period_end_yyyymmdd}-{seq3}`

Example:

`TS-20260216-20260222-001`

Generation rules:

1. Sequence is per period (`seq3` starts at `001`).
2. Batch ID stored in `payroll_export_batch.batch_id` (unique).
3. Batch status lifecycle:
  - `GENERATED -> DOWNLOADED -> ARCHIVED`

### 2.2 Existing persistence linkage

- Header table: `payroll_export_batch`
  - `batch_id`, `period_id`, `status`, `export_format`, `line_count`, `generated_by`, `generated_at`, `rule_set_id`, `csv_uri`, `xlsx_uri`, `checksum_sha256`
- Line table: `payroll_export_line`
  - `payroll_export_batch_id`, `line_no`, `timesheet_header_id`, `employee_id`, `earnings_code`, hour buckets, payload

Traceability:
- Every export line is linked to `timesheet_header_id`.
- Batch hash (`checksum_sha256`) verifies file integrity/reproducibility.

### 2.3 Audit linkage

For each export operation, write immutable audit entries:

1. `audit_event` row:
  - `entity_table = payroll_export_batch`
  - `entity_pk = <batch primary id>`
  - `operation = EXPORT`
  - actor, request_id, timestamp, reason
2. `audit_field_change` rows:
  - batch status transition
  - line count
  - checksum/hash
  - file URIs

Recommended (if extending schema):
- add `input_signature_sha256` to `payroll_export_batch` for explicit "same inputs" detection.
- add `export_contract_version` and `generator_version` columns for stronger reproducibility evidence.

## 3) Examples

### 3.1 Example `Summary` CSV

```csv
batch_id,batch_generated_at_utc,export_contract_version,rule_set_id,employee_number,employee_name,period_start,period_end,workflow_status,normal_hours,overtime_hours,public_holiday_worked_hours,leave_total_hours,gross_paid_hours,flag_missing_approvals,flag_missing_days,flag_abnormal_totals,exception_codes,export_ready
TS-20260216-20260222-001,2026-02-23T03:15:22Z,timesheet-payroll-v1,7,E1001,Ana Lee,2026-02-16,2026-02-22,PAYROLL_VALIDATED,38.00,4.00,0.00,8.00,50.00,false,false,false,,true
TS-20260216-20260222-001,2026-02-23T03:15:22Z,timesheet-payroll-v1,7,E1022,Marco Silva,2026-02-16,2026-02-22,PAYROLL_VALIDATED,32.00,0.00,8.00,0.00,40.00,false,false,false,,true
TS-20260216-20260222-001,2026-02-23T03:15:22Z,timesheet-payroll-v1,7,E1088,Chris Tan,2026-02-16,2026-02-22,MANAGER_APPROVED,36.00,0.00,0.00,0.00,36.00,true,true,false,MISSING_APPROVAL;MISSING_DAYS,false
```

### 3.2 Example `Lines` CSV (leave by code included)

```csv
batch_id,line_no,employee_number,period_start,period_end,earning_code,leave_code,line_type,normal_hours,overtime_hours,public_holiday_worked_hours,leave_hours,project_code,cost_code,is_paid
TS-20260216-20260222-001,1,E1001,2026-02-16,2026-02-22,NORMAL,,EARNING,38.00,0.00,0.00,0.00,PRJ-OPS,CC-100,true
TS-20260216-20260222-001,2,E1001,2026-02-16,2026-02-22,OT,,EARNING,0.00,4.00,0.00,0.00,PRJ-OPS,CC-100,true
TS-20260216-20260222-001,3,E1001,2026-02-16,2026-02-22,LEAVE_ANNUAL,AL,LEAVE,0.00,0.00,0.00,8.00,,,true
TS-20260216-20260222-001,4,E1022,2026-02-16,2026-02-22,PH_WORKED,,EARNING,0.00,0.00,8.00,0.00,PRJ-SITE,CC-220,true
TS-20260216-20260222-001,5,E1022,2026-02-16,2026-02-22,NORMAL,,EARNING,32.00,0.00,0.00,0.00,PRJ-SITE,CC-220,true
```

### 3.3 Example `Exceptions` CSV

```csv
batch_id,employee_number,period_start,period_end,severity,rule_code,message,blocking,resolution_status
TS-20260216-20260222-001,E1088,2026-02-16,2026-02-22,ERROR,MISSING_APPROVAL,Timesheet not manager/payroll approved,true,OPEN
TS-20260216-20260222-001,E1088,2026-02-16,2026-02-22,ERROR,MISSING_DAYS,Required period dates are not fully covered,true,OPEN
TS-20260216-20260222-001,E1120,2026-02-16,2026-02-22,WARNING,ABNORMAL_TOTALS,Paid total exceeds configured anomaly threshold,false,OPEN
```

### 3.4 Example Excel mapping

- Sheet `Summary`: same columns/order as Summary CSV.
- Sheet `Lines`: same columns/order as Lines CSV.
- Sheet `Exceptions`: same columns/order as Exceptions CSV.
- Workbook metadata:
  - `batch_id`
  - `checksum_sha256`
  - `export_contract_version`
  - `generated_at_utc`
