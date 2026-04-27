import { openReadOnlyDb } from "./db";

export interface RunQueryOptions {
  dbPath: string;
  sql: string;
  params?: Array<string | number | bigint | null | Uint8Array>;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

const WRITE_STATEMENT =
  /^\s*(INSERT|UPDATE|DELETE|REPLACE|DROP|ALTER|CREATE|ATTACH|DETACH|REINDEX|VACUUM|PRAGMA)\b/i;

export function runQuery(options: RunQueryOptions): QueryResult {
  if (WRITE_STATEMENT.test(options.sql)) {
    throw new Error("know query is read-only; use SELECT statements only.");
  }

  const db = openReadOnlyDb(options.dbPath);
  try {
    const stmt = db.prepare(options.sql);
    const rows = (
      options.params ? stmt.all(...options.params) : stmt.all()
    ) as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows };
  } finally {
    db.close();
  }
}

export function describeSchema(dbPath: string): string {
  const db = openReadOnlyDb(dbPath);
  try {
    const rows = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL ORDER BY type DESC, name",
      )
      .all() as Array<{ sql: string }>;
    return rows.map((r) => `${r.sql};`).join("\n\n");
  } finally {
    db.close();
  }
}

export function formatQueryResult(result: QueryResult): string {
  if (result.rows.length === 0) {
    return "(no rows)";
  }
  const lines: string[] = [];
  lines.push(result.columns.join("\t"));
  for (const row of result.rows) {
    lines.push(
      result.columns
        .map((col) => {
          const value = row[col];
          if (value === null || value === undefined) return "";
          return String(value);
        })
        .join("\t"),
    );
  }
  return lines.join("\n");
}
