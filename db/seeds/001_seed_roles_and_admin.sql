BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('timesheet-seed-lock', 0));

INSERT INTO app_role (role_code, role_name)
VALUES
  ('ADMIN', 'Administrator'),
  ('EMPLOYEE', 'Employee'),
  ('MANAGER', 'Manager'),
  ('PAYROLL', 'Payroll')
ON CONFLICT (role_code) DO UPDATE
SET role_name = EXCLUDED.role_name;

INSERT INTO employee (employee_number, first_name, last_name, email, timezone, active)
VALUES
  ('ADM0001', 'System', 'Admin', 'admin@timesheet.local', 'Australia/Sydney', TRUE),
  ('E1001', 'Ana', 'Lee', 'ana.lee@timesheet.local', 'Australia/Sydney', TRUE),
  ('E2001', 'Marta', 'Ng', 'marta.ng@timesheet.local', 'Australia/Sydney', TRUE),
  ('E3001', 'Paul', 'Tran', 'paul.tran@timesheet.local', 'Australia/Sydney', TRUE)
ON CONFLICT (employee_number) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  timezone = EXCLUDED.timezone,
  active = EXCLUDED.active;

UPDATE employee e
SET manager_employee_id = m.id
FROM employee m
WHERE e.employee_number = 'E1001' AND m.employee_number = 'E2001';

INSERT INTO employee_role (employee_id, role_id)
SELECT e.id, r.id
FROM employee e
JOIN app_role r ON (
  (e.employee_number = 'ADM0001' AND r.role_code IN ('ADMIN', 'PAYROLL')) OR
  (e.employee_number = 'E1001' AND r.role_code = 'EMPLOYEE') OR
  (e.employee_number = 'E2001' AND r.role_code IN ('MANAGER', 'EMPLOYEE')) OR
  (e.employee_number = 'E3001' AND r.role_code = 'PAYROLL')
)
ON CONFLICT (employee_id, role_id) DO NOTHING;

INSERT INTO auth_credential (employee_id, password_hash, password_algo, must_reset)
SELECT e.id, '$2b$12$J0vfG3KHpYszv3AfWnDn4eY6efYvd3d9p1f9omv2I2TNL6fMvKfA2', 'bcrypt', TRUE
FROM employee e
WHERE e.employee_number IN ('ADM0001', 'E1001', 'E2001', 'E3001')
ON CONFLICT (employee_id) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  password_algo = EXCLUDED.password_algo,
  must_reset = EXCLUDED.must_reset;

INSERT INTO seed_history (seed_key, checksum_sha256)
VALUES ('S001', repeat('a', 64))
ON CONFLICT (seed_key) DO UPDATE
SET
  checksum_sha256 = EXCLUDED.checksum_sha256,
  applied_at = now();

COMMIT;
