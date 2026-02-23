import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "./env.js";

export interface SqliteAppState {
  months: Record<string, unknown>;
  plannedLeave: unknown[];
  signatureProfiles: Record<string, unknown>;
}

const sqlitePath = path.isAbsolute(env.SQLITE_PATH)
  ? env.SQLITE_PATH
  : path.resolve(process.cwd(), env.SQLITE_PATH);

fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

const sqlite = new Database(sqlitePath);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    months_json TEXT NOT NULL,
    planned_leave_json TEXT NOT NULL,
    signature_profiles_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
  )
`);

const tableColumns = sqlite
  .prepare("PRAGMA table_info(app_state)")
  .all() as Array<{ name: string }>;

if (!tableColumns.some((column) => column.name === "signature_profiles_json")) {
  sqlite.exec("ALTER TABLE app_state ADD COLUMN signature_profiles_json TEXT NOT NULL DEFAULT '{}'");
}

export function readAppState(): SqliteAppState {
  const row = sqlite
    .prepare("SELECT months_json, planned_leave_json, signature_profiles_json FROM app_state WHERE id = 1")
    .get() as { months_json: string; planned_leave_json: string; signature_profiles_json: string } | undefined;

  if (!row) {
    return {
      months: {},
      plannedLeave: [],
      signatureProfiles: {}
    };
  }

  try {
    return {
      months: JSON.parse(row.months_json) as Record<string, unknown>,
      plannedLeave: JSON.parse(row.planned_leave_json) as unknown[],
      signatureProfiles: JSON.parse(row.signature_profiles_json) as Record<string, unknown>
    };
  } catch {
    return {
      months: {},
      plannedLeave: [],
      signatureProfiles: {}
    };
  }
}

export function writeAppState(state: SqliteAppState): void {
  sqlite
    .prepare(
      `
      INSERT INTO app_state (id, months_json, planned_leave_json, signature_profiles_json, updated_at)
      VALUES (1, @monthsJson, @plannedLeaveJson, @signatureProfilesJson, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        months_json = excluded.months_json,
        planned_leave_json = excluded.planned_leave_json,
        signature_profiles_json = excluded.signature_profiles_json,
        updated_at = excluded.updated_at
    `
    )
    .run({
      monthsJson: JSON.stringify(state.months),
      plannedLeaveJson: JSON.stringify(state.plannedLeave),
      signatureProfilesJson: JSON.stringify(state.signatureProfiles),
      updatedAt: new Date().toISOString()
    });
}
