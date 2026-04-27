import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ResolvedAnchor } from "./anchors";
import type { AnchorSpec, ParsedItem, ParsedLink } from "./parser";

export interface IndexedFile {
  path: string;
  contentHash: string;
  items: ParsedItem[];
}

export interface AnchorBinding {
  ownerId: string;
  spec: AnchorSpec;
  resolved: ResolvedAnchor[];
}

export interface IndexBundle {
  files: IndexedFile[];
  anchors: AnchorBinding[];
  links: ParsedLink[];
  /** ISO timestamp used as the moment of indexing. */
  indexedAt: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT,
  path TEXT NOT NULL,
  body TEXT NOT NULL,
  frontmatter_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  rationale TEXT,
  status TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS anchors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  resolved INTEGER NOT NULL,
  resolved_path TEXT,
  file_hash TEXT,
  last_changed_at TEXT
);

CREATE TABLE IF NOT EXISTS links (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_kind ON items(kind);
CREATE INDEX IF NOT EXISTS idx_anchors_owner ON anchors(owner_id);
CREATE INDEX IF NOT EXISTS idx_anchors_path ON anchors(resolved_path);
CREATE INDEX IF NOT EXISTS idx_links_from ON links(from_id);
CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_id);
`;

export async function writeIndex(
  dbPath: string,
  bundle: IndexBundle,
): Promise<void> {
  await mkdir(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  try {
    db.exec(
      "DROP TABLE IF EXISTS links; DROP TABLE IF EXISTS anchors; DROP TABLE IF EXISTS rules; DROP TABLE IF EXISTS rationales; DROP TABLE IF EXISTS items;",
    );
    db.exec(SCHEMA);

    const insertItem = db.prepare(
      "INSERT INTO items(id, kind, title, path, body, frontmatter_json, content_hash, reviewed_at) VALUES (?,?,?,?,?,?,?,?)",
    );
    const insertRule = db.prepare(
      "INSERT INTO rules(id, statement, rationale, status, reviewed_at) VALUES (?,?,?,?,?)",
    );
    const insertAnchor = db.prepare(
      "INSERT INTO anchors(owner_id, kind, value, resolved, resolved_path, file_hash, last_changed_at) VALUES (?,?,?,?,?,?,?)",
    );
    const insertLink = db.prepare(
      "INSERT INTO links(from_id, to_id, relation) VALUES (?,?,?)",
    );

    db.exec("BEGIN");

    const anchorsByOwner = groupBy(bundle.anchors, (a) => a.ownerId);

    for (const file of bundle.files) {
      for (const item of file.items) {
        insertItem.run(
          item.id,
          item.kind,
          item.title ?? null,
          file.path,
          item.body,
          JSON.stringify(item.frontmatter ?? {}),
          file.contentHash,
          item.reviewed ?? null,
        );

        const ownAnchors = anchorsByOwner.get(item.id) ?? [];
        for (const binding of ownAnchors) {
          for (const r of binding.resolved) {
            insertAnchor.run(
              item.id,
              r.kind,
              r.value,
              r.resolved ? 1 : 0,
              r.resolvedPath ?? null,
              r.fileHash ?? null,
              r.fileMtime ?? bundle.indexedAt,
            );
          }
        }

        if (item.kind === "rule") {
          const status = computeRuleStatus(item, ownAnchors);
          insertRule.run(
            item.id,
            item.title ?? "",
            item.rationale ?? null,
            status,
            item.reviewed ?? null,
          );
        }
      }
    }

    for (const link of bundle.links) {
      insertLink.run(link.from, link.to, link.relation);
    }

    db.exec("COMMIT");
  } finally {
    db.close();
  }
}

export function openReadOnlyDb(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  registerSqlHelpers(db);
  return db;
}

function registerSqlHelpers(db: DatabaseSync): void {
  // anchors_match(queryPath, resolvedPath) -> 1 if the resolved path matches.
  // For MVP, an exact match suffices because globs are pre-expanded into
  // resolved_path rows at index time.
  db.function(
    "anchors_match",
    { deterministic: true },
    (queryPath: unknown, resolvedPath: unknown) => {
      if (typeof queryPath !== "string" || typeof resolvedPath !== "string") {
        return 0;
      }
      return queryPath === resolvedPath ? 1 : 0;
    },
  );
}

function computeRuleStatus(
  item: ParsedItem,
  anchors: AnchorBinding[],
): "active" | "stale" | "broken-anchor" | "deprecated" {
  if (item.status === "deprecated") return "deprecated";

  const flat = anchors.flatMap((a) => a.resolved);

  if (flat.length > 0 && flat.some((a) => !a.resolved)) {
    return "broken-anchor";
  }

  if (!item.reviewed) {
    return flat.length > 0 ? "stale" : "active";
  }

  const reviewedTs = Date.parse(item.reviewed);
  if (Number.isNaN(reviewedTs)) {
    return "stale";
  }

  for (const a of flat) {
    if (!a.fileMtime) continue;
    const changed = Date.parse(a.fileMtime);
    if (!Number.isNaN(changed) && changed > reviewedTs) {
      return "stale";
    }
  }

  return "active";
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}
