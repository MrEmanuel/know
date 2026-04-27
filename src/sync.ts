import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { glob } from "tinyglobby";
import { openReadOnlyDb } from "./db";
import { indexProject, type IndexResult } from "./indexer";

export interface SyncProjectOptions {
  projectRoot: string;
  knowledgeDir?: string;
  dbPath?: string;
}

export interface SyncResult extends IndexResult {
  changed: boolean;
}

const KNOWLEDGE_GLOBS = ["concepts/**/*.md", "rules/**/*.md"];

export async function syncProject(
  options: SyncProjectOptions,
): Promise<SyncResult> {
  const knowledgeDir = options.knowledgeDir ?? ".knowledge";
  const knowledgeRoot = join(options.projectRoot, knowledgeDir);
  const dbPath =
    options.dbPath ?? join(knowledgeRoot, "indexes", "knowledge.sqlite");

  const matches = await glob(KNOWLEDGE_GLOBS, {
    cwd: knowledgeRoot,
    absolute: true,
    onlyFiles: true,
  });

  const onDisk = new Map<string, string>();
  for (const file of matches) {
    const content = await readFile(file, "utf8");
    onDisk.set(file, sha256(content));
  }

  if (existsSync(dbPath)) {
    const stored = readStoredHashes(dbPath);
    if (sameHashes(onDisk, stored)) {
      const counts = readStoredCounts(dbPath);
      return {
        changed: false,
        dbPath,
        fileCount: counts.fileCount,
        itemCount: counts.itemCount,
        anchorCount: counts.anchorCount,
        brokenAnchorCount: counts.brokenAnchorCount,
      };
    }
  }

  const result = await indexProject({
    projectRoot: options.projectRoot,
    knowledgeDir,
    dbPath,
  });
  return { changed: true, ...result };
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function readStoredHashes(dbPath: string): Map<string, string> {
  const db = openReadOnlyDb(dbPath);
  try {
    const rows = db
      .prepare("SELECT DISTINCT path, content_hash FROM items")
      .all() as Array<{ path: string; content_hash: string }>;
    return new Map(rows.map((r) => [r.path, r.content_hash]));
  } finally {
    db.close();
  }
}

interface StoredCounts {
  fileCount: number;
  itemCount: number;
  anchorCount: number;
  brokenAnchorCount: number;
}

function readStoredCounts(dbPath: string): StoredCounts {
  const db = openReadOnlyDb(dbPath);
  try {
    const fileCount = (
      db.prepare("SELECT COUNT(DISTINCT path) as n FROM items").get() as {
        n: number;
      }
    ).n;
    const itemCount = (
      db.prepare("SELECT COUNT(*) as n FROM items").get() as { n: number }
    ).n;
    const anchorCount = (
      db.prepare("SELECT COUNT(*) as n FROM anchors").get() as { n: number }
    ).n;
    const brokenAnchorCount = (
      db
        .prepare("SELECT COUNT(*) as n FROM anchors WHERE resolved = 0")
        .get() as {
        n: number;
      }
    ).n;
    return { fileCount, itemCount, anchorCount, brokenAnchorCount };
  } finally {
    db.close();
  }
}

function sameHashes(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}
