BEGIN;

CREATE TABLE app_role (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_code TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employee_role (
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES app_role(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by BIGINT NULL REFERENCES employee(id) ON DELETE SET NULL,
  PRIMARY KEY (employee_id, role_id)
);
CREATE INDEX idx_employee_role_role ON employee_role(role_id);

CREATE TABLE auth_credential (
  employee_id BIGINT PRIMARY KEY REFERENCES employee(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'argon2id',
  password_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  must_reset BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE refresh_session (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  token_family UUID NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  replaced_by_session_id BIGINT NULL REFERENCES refresh_session(id) ON DELETE SET NULL,
  ip INET NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_session_active
  ON refresh_session(employee_id, expires_at)
  WHERE revoked_at IS NULL;

COMMIT;
