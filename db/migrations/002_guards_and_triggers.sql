-- Operational guards and trigger helpers
-- 1) Keep updated_at current on mutable business tables
-- 2) Make audit tables append-only
-- 3) Prevent edits/deletes on locked timesheet headers/day entries

BEGIN;

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_employee
BEFORE UPDATE ON employee
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER set_updated_at_timesheet_header
BEFORE UPDATE ON timesheet_header
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER set_updated_at_timesheet_day_entry
BEFORE UPDATE ON timesheet_day_entry
FOR EACH ROW
EXECUTE FUNCTION trg_set_updated_at();

CREATE OR REPLACE FUNCTION trg_prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit table % is append-only', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER prevent_update_delete_audit_event
BEFORE UPDATE OR DELETE ON audit_event
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_audit_mutation();

CREATE TRIGGER prevent_update_delete_audit_field_change
BEFORE UPDATE OR DELETE ON audit_field_change
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_audit_mutation();

CREATE OR REPLACE FUNCTION trg_prevent_locked_header_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.workflow_status = 'LOCKED' THEN
    RAISE EXCEPTION 'Locked timesheet_header % is immutable', OLD.id
      USING ERRCODE = '55000';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER prevent_update_delete_locked_header
BEFORE UPDATE OR DELETE ON timesheet_header
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_locked_header_mutation();

CREATE OR REPLACE FUNCTION trg_prevent_locked_day_entry_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_header_status workflow_status;
  v_header_id BIGINT;
BEGIN
  v_header_id := COALESCE(NEW.timesheet_header_id, OLD.timesheet_header_id);

  SELECT th.workflow_status
    INTO v_header_status
  FROM timesheet_header th
  WHERE th.id = v_header_id;

  IF v_header_status = 'LOCKED' THEN
    RAISE EXCEPTION 'Day entry cannot be changed because timesheet_header % is LOCKED', v_header_id
      USING ERRCODE = '55000';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER prevent_update_delete_locked_day_entry
BEFORE UPDATE OR DELETE ON timesheet_day_entry
FOR EACH ROW
EXECUTE FUNCTION trg_prevent_locked_day_entry_mutation();

COMMIT;
