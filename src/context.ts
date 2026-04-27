import { isAbsolute, join } from "node:path";
import { openReadOnlyDb } from "./db";

export interface GetContextOptions {
  dbPath: string;
  projectRoot: string;
  /** Path to the file (absolute or relative to projectRoot). */
  targetPath: string;
}

export interface ContextRule {
  id: string;
  title: string;
  status: string;
  reviewed: string | null;
  body: string;
  rationale: string | null;
  staleReason?: string;
}

export interface ContextConcept {
  id: string;
  title: string;
  body: string;
}

export interface ContextBrokenAnchor {
  ownerId: string;
  ownerTitle: string;
  kind: string;
  value: string;
}

export interface ContextResult {
  targetPath: string;
  activeRules: ContextRule[];
  staleRules: ContextRule[];
  concepts: ContextConcept[];
  brokenAnchors: ContextBrokenAnchor[];
}

export function getContext(options: GetContextOptions): ContextResult {
  const absTarget = isAbsolute(options.targetPath)
    ? options.targetPath
    : join(options.projectRoot, options.targetPath);

  const db = openReadOnlyDb(options.dbPath);
  try {
    const matchingOwnerIds = new Set(
      (
        db
          .prepare(
            `SELECT DISTINCT a.owner_id
             FROM anchors a
             JOIN items i ON i.id = a.owner_id
             WHERE i.kind = 'rule'
               AND a.resolved = 1
               AND anchors_match(?, a.resolved_path)`,
          )
          .all(absTarget) as Array<{ owner_id: string }>
      ).map((r) => r.owner_id),
    );

    const activeRules: ContextRule[] = [];
    const staleRules: ContextRule[] = [];
    const concepts: ContextConcept[] = [];

    const matchingRulePaths = new Set<string>();
    const matchingRuleIds = new Set<string>();

    for (const ownerId of matchingOwnerIds) {
      const item = db
        .prepare("SELECT id, kind, title, body, path FROM items WHERE id = ?")
        .get(ownerId) as
        | {
            id: string;
            kind: string;
            title: string | null;
            body: string;
            path: string;
          }
        | undefined;
      if (!item) continue;

      const rule = db
        .prepare("SELECT status, rationale, reviewed_at FROM rules WHERE id = ?")
        .get(ownerId) as
        | {
            status: string;
            rationale: string | null;
            reviewed_at: string | null;
          }
        | undefined;
      if (!rule) continue;

      matchingRuleIds.add(item.id);

      const ruleRow: ContextRule = {
        id: item.id,
        title: item.title ?? item.id,
        status: rule.status,
        reviewed: rule.reviewed_at,
        body: item.body,
        rationale: rule.rationale,
      };

      if (rule.status === "active") {
        activeRules.push(ruleRow);
        matchingRulePaths.add(item.path);
      } else if (rule.status === "stale") {
        ruleRow.staleReason = describeStale(db, ownerId, rule.reviewed_at);
        staleRules.push(ruleRow);
        matchingRulePaths.add(item.path);
      } else if (rule.status === "broken-anchor") {
        // broken rules are surfaced via the brokenAnchors section
        matchingRulePaths.add(item.path);
      }
    }

    for (const concept of loadConceptsForRules(db, matchingRuleIds)) {
      concepts.push(concept);
    }

    activeRules.sort((a, b) => a.id.localeCompare(b.id));
    staleRules.sort((a, b) => a.id.localeCompare(b.id));
    concepts.sort((a, b) => a.id.localeCompare(b.id));

    const brokenAnchors: ContextBrokenAnchor[] = [];
    if (matchingRulePaths.size > 0) {
      const placeholders = Array.from(matchingRulePaths)
        .map(() => "?")
        .join(",");
      const broken = db
        .prepare(
          `SELECT a.owner_id, a.kind, a.value, i.title
           FROM anchors a
           JOIN items i ON i.id = a.owner_id
           WHERE a.resolved = 0
             AND i.path IN (${placeholders})
           ORDER BY a.owner_id, a.kind, a.value`,
        )
        .all(...matchingRulePaths) as Array<{
        owner_id: string;
        kind: string;
        value: string;
        title: string | null;
      }>;
      for (const row of broken) {
        brokenAnchors.push({
          ownerId: row.owner_id,
          ownerTitle: row.title ?? row.owner_id,
          kind: row.kind,
          value: row.value,
        });
      }
    }

    return {
      targetPath: options.targetPath,
      activeRules,
      staleRules,
      concepts,
      brokenAnchors,
    };
  } finally {
    db.close();
  }
}

function loadConceptsForRules(
  db: ReturnType<typeof openReadOnlyDb>,
  ruleIds: Set<string>,
): ContextConcept[] {
  if (ruleIds.size === 0) return [];

  const placeholders = Array.from(ruleIds)
    .map(() => "?")
    .join(",");
  const rows = db
    .prepare(
      `SELECT DISTINCT i.id, i.title, i.body
       FROM links l
       JOIN items i ON i.id = l.to_id
       WHERE l.relation = 'concept'
         AND l.from_id IN (${placeholders})
         AND i.kind = 'concept'`,
    )
    .all(...ruleIds) as Array<{
    id: string;
    title: string | null;
    body: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? row.id,
    body: row.body,
  }));
}

function describeStale(
  db: ReturnType<typeof openReadOnlyDb>,
  ownerId: string,
  reviewedAt: string | null,
): string {
  if (!reviewedAt) return "no reviewed_at recorded";

  const rows = db
    .prepare(
      "SELECT resolved_path, last_changed_at FROM anchors WHERE owner_id = ? AND resolved = 1",
    )
    .all(ownerId) as Array<{
    resolved_path: string | null;
    last_changed_at: string | null;
  }>;

  const reviewedTs = Date.parse(reviewedAt);
  for (const row of rows) {
    if (!row.last_changed_at) continue;
    const changed = Date.parse(row.last_changed_at);
    if (!Number.isNaN(changed) && changed > reviewedTs) {
      return `${row.resolved_path ?? "anchor"} changed ${row.last_changed_at} after reviewed ${reviewedAt}`;
    }
  }

  return `reviewed ${reviewedAt}, anchor changed since`;
}

export function renderContext(ctx: ContextResult): string {
  const lines: string[] = [];
  lines.push(`# Knowledge for ${ctx.targetPath}`);
  lines.push("");

  lines.push(`## Active rules (${ctx.activeRules.length})`);
  lines.push("");
  if (ctx.activeRules.length === 0) {
    lines.push("(none)");
    lines.push("");
  } else {
    for (const rule of ctx.activeRules) {
      const reviewed = rule.reviewed ? `, reviewed ${rule.reviewed}` : "";
      lines.push(`### ${rule.title} [${rule.status}${reviewed}]`);
      lines.push("");
      if (rule.body) {
        lines.push(rule.body);
        lines.push("");
      }
      if (rule.rationale) {
        lines.push("Rationale:");
        lines.push("");
        lines.push(rule.rationale);
        lines.push("");
      }
    }
  }

  lines.push(`## Stale rules (${ctx.staleRules.length})`);
  lines.push("");
  if (ctx.staleRules.length === 0) {
    lines.push("(none)");
    lines.push("");
  } else {
    for (const rule of ctx.staleRules) {
      lines.push(
        `### ${rule.title} [stale${rule.staleReason ? `: ${rule.staleReason}` : ""}]`,
      );
      lines.push("");
      if (rule.body) {
        lines.push(rule.body);
        lines.push("");
      }
      if (rule.rationale) {
        lines.push("Rationale:");
        lines.push("");
        lines.push(rule.rationale);
        lines.push("");
      }
    }
  }

  lines.push("## Connected concepts");
  lines.push("");
  if (ctx.concepts.length === 0) {
    lines.push("(none)");
    lines.push("");
  } else {
    for (const c of ctx.concepts) {
      const summary = firstLine(c.body);
      lines.push(`- ${c.id} — ${c.title}${summary ? ` — ${summary}` : ""}`);
    }
    lines.push("");
  }

  lines.push("## Broken anchors touching this file");
  lines.push("");
  if (ctx.brokenAnchors.length === 0) {
    lines.push("(none)");
  } else {
    for (const a of ctx.brokenAnchors) {
      lines.push(`- ${a.ownerId} — ${a.kind}: ${a.value}`);
    }
  }

  return lines.join("\n") + "\n";
}

function firstLine(text: string): string {
  const trimmed = text.trim();
  const newlineIdx = trimmed.indexOf("\n");
  return newlineIdx === -1 ? trimmed : trimmed.slice(0, newlineIdx);
}
