import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { openReadOnlyDb, writeIndex, type IndexBundle } from "../src/db";
import type { ParsedItem, ParsedLink } from "../src/parser";
import type { ResolvedAnchor } from "../src/anchors";

async function tmpDb() {
  const dir = await mkdtemp(join(tmpdir(), "know-db-"));
  return join(dir, "knowledge.sqlite");
}

function concept(over: Partial<ParsedItem> = {}): ParsedItem {
  return {
    id: "concept.label",
    kind: "concept",
    title: "Label",
    body: "A label.",
    anchors: [],
    frontmatter: {},
    ...over,
  };
}

function rule(over: Partial<ParsedItem> = {}): ParsedItem {
  return {
    id: "rules.labels.x",
    kind: "rule",
    title: "X",
    status: "active",
    body: "rule body",
    rationale: "rule why",
    anchors: [],
    frontmatter: {},
    ...over,
  };
}

function bundle(parts: Partial<IndexBundle>): IndexBundle {
  return {
    files: [],
    anchors: [],
    links: [],
    indexedAt: "2026-04-26T00:00:00Z",
    ...parts,
  };
}

describe("writeIndex", () => {
  test("writes items, rules, anchors, and links", async () => {
    const dbPath = await tmpDb();

    const c = concept();
    const r = rule({
      reviewed: "2026-04-20",
      anchors: [{ kind: "path", value: "src/labels/visibility.ts" }],
    });

    await writeIndex(
      dbPath,
      bundle({
        files: [
          {
            path: "/p/.knowledge/concepts/label.md",
            contentHash: "h1",
            items: [c],
          },
          {
            path: "/p/.knowledge/rules/labels.md",
            contentHash: "h2",
            items: [r],
          },
        ],
        anchors: [
          {
            ownerId: r.id,
            spec: { kind: "path", value: "src/labels/visibility.ts" },
            resolved: [
              {
                kind: "path",
                value: "src/labels/visibility.ts",
                resolved: true,
                resolvedPath: "/p/src/labels/visibility.ts",
                fileHash: "filehash",
                fileMtime: "2026-04-10T00:00:00Z",
              } satisfies ResolvedAnchor & { fileMtime?: string },
            ],
          },
        ],
        links: [
          { from: "concept.label", to: "concept.item", relation: "related" },
        ] satisfies ParsedLink[],
      }),
    );

    const db = openReadOnlyDb(dbPath);

    const items = db
      .prepare("SELECT id, kind, title FROM items ORDER BY id")
      .all() as Array<{ id: string; kind: string; title: string }>;
    expect(items.map((i) => i.id)).toEqual(["concept.label", "rules.labels.x"]);

    const rules = db
      .prepare("SELECT id, status, rationale, reviewed_at FROM rules")
      .all() as Array<{
      id: string;
      status: string;
      rationale: string | null;
      reviewed_at: string | null;
    }>;
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("rules.labels.x");
    expect(rules[0].rationale).toBe("rule why");

    const anchors = db
      .prepare(
        "SELECT owner_id, kind, value, resolved, resolved_path, file_hash FROM anchors",
      )
      .all() as Array<{
      owner_id: string;
      kind: string;
      resolved: number;
      resolved_path: string | null;
    }>;
    expect(anchors).toHaveLength(1);
    expect(anchors[0].owner_id).toBe("rules.labels.x");
    expect(anchors[0].resolved).toBe(1);

    const links = db
      .prepare("SELECT from_id, to_id, relation FROM links")
      .all();
    expect(links).toHaveLength(1);

    db.close();
  });

  test("computes rule status: broken-anchor when any anchor is unresolved", async () => {
    const dbPath = await tmpDb();
    const r = rule({
      reviewed: "2026-04-20",
      anchors: [{ kind: "symbol", value: "Missing" }],
    });

    await writeIndex(
      dbPath,
      bundle({
        files: [
          { path: "/p/.knowledge/rules/x.md", contentHash: "h", items: [r] },
        ],
        anchors: [
          {
            ownerId: r.id,
            spec: { kind: "symbol", value: "Missing" },
            resolved: [{ kind: "symbol", value: "Missing", resolved: false }],
          },
        ],
      }),
    );

    const db = openReadOnlyDb(dbPath);
    const status = db
      .prepare("SELECT status FROM rules WHERE id = ?")
      .get(r.id) as { status: string };
    expect(status.status).toBe("broken-anchor");
    db.close();
  });

  test("computes rule status: stale when anchored file changed after reviewed_at", async () => {
    const dbPath = await tmpDb();
    const r = rule({
      reviewed: "2026-04-01",
      anchors: [{ kind: "path", value: "src/x.ts" }],
    });

    await writeIndex(
      dbPath,
      bundle({
        files: [
          { path: "/p/.knowledge/rules/x.md", contentHash: "h", items: [r] },
        ],
        anchors: [
          {
            ownerId: r.id,
            spec: { kind: "path", value: "src/x.ts" },
            resolved: [
              {
                kind: "path",
                value: "src/x.ts",
                resolved: true,
                resolvedPath: "/p/src/x.ts",
                fileHash: "f",
                fileMtime: "2026-04-20T00:00:00Z",
              },
            ],
          },
        ],
      }),
    );

    const db = openReadOnlyDb(dbPath);
    const status = db
      .prepare("SELECT status FROM rules WHERE id = ?")
      .get(r.id) as { status: string };
    expect(status.status).toBe("stale");
    db.close();
  });

  test("computes rule status: stale when reviewed_at is missing", async () => {
    const dbPath = await tmpDb();
    const r = rule({
      reviewed: undefined,
      anchors: [{ kind: "path", value: "src/x.ts" }],
    });

    await writeIndex(
      dbPath,
      bundle({
        files: [
          { path: "/p/.knowledge/rules/x.md", contentHash: "h", items: [r] },
        ],
        anchors: [
          {
            ownerId: r.id,
            spec: { kind: "path", value: "src/x.ts" },
            resolved: [
              {
                kind: "path",
                value: "src/x.ts",
                resolved: true,
                resolvedPath: "/p/src/x.ts",
                fileHash: "f",
                fileMtime: "2026-04-01T00:00:00Z",
              },
            ],
          },
        ],
      }),
    );

    const db = openReadOnlyDb(dbPath);
    const status = db
      .prepare("SELECT status FROM rules WHERE id = ?")
      .get(r.id) as { status: string };
    expect(status.status).toBe("stale");
    db.close();
  });

  test("computes rule status: active when reviewed_at is fresh and anchors resolved", async () => {
    const dbPath = await tmpDb();
    const r = rule({
      reviewed: "2026-04-30",
      anchors: [{ kind: "path", value: "src/x.ts" }],
    });

    await writeIndex(
      dbPath,
      bundle({
        files: [
          { path: "/p/.knowledge/rules/x.md", contentHash: "h", items: [r] },
        ],
        anchors: [
          {
            ownerId: r.id,
            spec: { kind: "path", value: "src/x.ts" },
            resolved: [
              {
                kind: "path",
                value: "src/x.ts",
                resolved: true,
                resolvedPath: "/p/src/x.ts",
                fileHash: "f",
                fileMtime: "2026-04-10T00:00:00Z",
              },
            ],
          },
        ],
      }),
    );

    const db = openReadOnlyDb(dbPath);
    const status = db
      .prepare("SELECT status FROM rules WHERE id = ?")
      .get(r.id) as { status: string };
    expect(status.status).toBe("active");
    db.close();
  });

  test("respects deprecated status from frontmatter", async () => {
    const dbPath = await tmpDb();
    const r = rule({
      status: "deprecated",
      reviewed: "2020-01-01",
      anchors: [{ kind: "path", value: "src/missing.ts" }],
    });

    await writeIndex(
      dbPath,
      bundle({
        files: [
          { path: "/p/.knowledge/rules/x.md", contentHash: "h", items: [r] },
        ],
        anchors: [
          {
            ownerId: r.id,
            spec: { kind: "path", value: "src/missing.ts" },
            resolved: [
              { kind: "path", value: "src/missing.ts", resolved: false },
            ],
          },
        ],
      }),
    );

    const db = openReadOnlyDb(dbPath);
    const status = db
      .prepare("SELECT status FROM rules WHERE id = ?")
      .get(r.id) as { status: string };
    expect(status.status).toBe("deprecated");
    db.close();
  });

  test("is idempotent — re-writing produces identical state", async () => {
    const dbPath = await tmpDb();
    const r = rule({ reviewed: "2026-04-30" });
    const b = bundle({
      files: [
        { path: "/p/.knowledge/rules/x.md", contentHash: "h", items: [r] },
      ],
    });

    await writeIndex(dbPath, b);
    await writeIndex(dbPath, b);

    const db = openReadOnlyDb(dbPath);
    const items = db.prepare("SELECT COUNT(*) as n FROM items").get() as {
      n: number;
    };
    const rules = db.prepare("SELECT COUNT(*) as n FROM rules").get() as {
      n: number;
    };
    expect(items.n).toBe(1);
    expect(rules.n).toBe(1);
    db.close();
  });
});

describe("openReadOnlyDb", () => {
  test("registers anchors_match() helper that matches paths and globs", async () => {
    const dbPath = await tmpDb();
    const r1 = rule({ id: "rules.labels.a" });
    const r2 = rule({ id: "rules.items.b" });

    await writeIndex(
      dbPath,
      bundle({
        files: [
          {
            path: "/p/.knowledge/rules/labels.md",
            contentHash: "h1",
            items: [r1],
          },
          {
            path: "/p/.knowledge/rules/items.md",
            contentHash: "h2",
            items: [r2],
          },
        ],
        anchors: [
          {
            ownerId: r1.id,
            spec: { kind: "path", value: "src/labels/visibility.ts" },
            resolved: [
              {
                kind: "path",
                value: "src/labels/visibility.ts",
                resolved: true,
                resolvedPath: "/p/src/labels/visibility.ts",
                fileHash: "f",
                fileMtime: "2026-04-10T00:00:00Z",
              },
            ],
          },
          {
            ownerId: r2.id,
            spec: { kind: "glob", value: "src/items/**" },
            resolved: [
              {
                kind: "glob",
                value: "src/items/**",
                resolved: true,
                resolvedPath: "/p/src/items/copy.ts",
                fileHash: "f2",
                fileMtime: "2026-04-10T00:00:00Z",
              },
            ],
          },
        ],
      }),
    );

    const db = openReadOnlyDb(dbPath);
    // include r2 too
    db.prepare(
      "INSERT OR IGNORE INTO items(id, kind, title, path, body, frontmatter_json, content_hash) VALUES (?,?,?,?,?,?,?)",
    );
    // Already inserted by writeIndex above. Query via helper:
    const rows = db
      .prepare(
        "SELECT DISTINCT owner_id FROM anchors WHERE anchors_match(?, resolved_path) ORDER BY owner_id",
      )
      .all("/p/src/labels/visibility.ts") as Array<{ owner_id: string }>;
    expect(rows.map((r) => r.owner_id)).toEqual(["rules.labels.a"]);

    const rows2 = db
      .prepare(
        "SELECT DISTINCT owner_id FROM anchors WHERE anchors_match(?, resolved_path) ORDER BY owner_id",
      )
      .all("/p/src/items/copy.ts") as Array<{ owner_id: string }>;
    expect(rows2.map((r) => r.owner_id)).toEqual(["rules.items.b"]);

    db.close();
  });

  test("opens database in read-only mode", async () => {
    const dbPath = await tmpDb();
    await writeIndex(
      dbPath,
      bundle({
        files: [
          {
            path: "/p/.knowledge/rules/x.md",
            contentHash: "h",
            items: [rule()],
          },
        ],
      }),
    );

    const db = openReadOnlyDb(dbPath);
    expect(() =>
      db.exec(
        "INSERT INTO items(id,kind,path,body,frontmatter_json,content_hash) VALUES('x','x','x','x','{}','x')",
      ),
    ).toThrow();
    db.close();
  });
});
