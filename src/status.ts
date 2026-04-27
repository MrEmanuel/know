import { openReadOnlyDb } from "./db";

export interface GetStatusOptions {
  dbPath: string;
}

export interface StatusResult {
  concepts: number;
  rules: {
    active: number;
    stale: number;
    brokenAnchor: number;
    deprecated: number;
    total: number;
  };
}

export function getStatus(options: GetStatusOptions): StatusResult {
  const db = openReadOnlyDb(options.dbPath);
  try {
    const concepts = countItemKind(db, "concept");
    const ruleStatusRows = db
      .prepare("SELECT status, COUNT(*) as n FROM rules GROUP BY status")
      .all() as Array<{ status: string; n: number }>;

    const rules = {
      active: 0,
      stale: 0,
      brokenAnchor: 0,
      deprecated: 0,
      total: 0,
    };

    for (const row of ruleStatusRows) {
      if (row.status === "active") rules.active = row.n;
      else if (row.status === "stale") rules.stale = row.n;
      else if (row.status === "broken-anchor") rules.brokenAnchor = row.n;
      else if (row.status === "deprecated") rules.deprecated = row.n;
      rules.total += row.n;
    }

    return { concepts, rules };
  } finally {
    db.close();
  }
}

function countItemKind(
  db: ReturnType<typeof openReadOnlyDb>,
  kind: string,
): number {
  return (
    db.prepare("SELECT COUNT(*) as n FROM items WHERE kind = ?").get(kind) as {
      n: number;
    }
  ).n;
}

export function renderStatus(status: StatusResult): string {
  const lines: string[] = [];
  lines.push(`Rules: ${status.rules.total}`);
  lines.push(`  active: ${status.rules.active}`);
  lines.push(`  stale: ${status.rules.stale}`);
  lines.push(`  broken-anchor: ${status.rules.brokenAnchor}`);
  lines.push(`  deprecated: ${status.rules.deprecated}`);
  lines.push(`Concepts: ${status.concepts}`);
  return lines.join("\n");
}
