BEGIN;

CREATE TABLE idempotency_key (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  actor_employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_status INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT ux_idempotency UNIQUE (idempotency_key, actor_employee_id, method, path)
);

CREATE INDEX idx_idempotency_expiry ON idempotency_key(expires_at);

COMMIT;
