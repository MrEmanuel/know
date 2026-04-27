import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { indexProject } from "../src/indexer";
import { openReadOnlyDb } from "../src/db";

async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), "know-index-"));
  await mkdir(join(root, ".knowledge", "concepts"), { recursive: true });
  await mkdir(join(root, ".knowledge", "rules"), { recursive: true });
  await mkdir(join(root, "src", "labels"), { recursive: true });
  return root;
}

describe("indexProject", () => {
  test("indexes a project end-to-end and produces queryable DB", async () => {
    const root = await makeProject();

    await writeFile(
      join(root, "src", "labels", "visibility.ts"),
      "export class LabelVisibility { compute() { return true } }\n",
    );

    await writeFile(
      join(root, ".knowledge", "concepts", "label.md"),
      [
        "---",
        "id: concept.label",
        "title: Label",
        "---",
        "",
        "Labels classify items.",
        "",
        "See [[concept.item]].",
        "",
      ].join("\n"),
    );

    await writeFile(
      join(root, ".knowledge", "rules", "labels.md"),
      [
        "# Labels",
        "",
        "## Hidden labels stay hidden",
        "status: active",
        "reviewed: 2030-01-01",
        "concept: concept.label",
        "anchors:",
        "  - symbol: LabelVisibility",
        "",
        "Hidden labels must remain hidden everywhere.",
        "",
        "### Rationale",
        "",
        "Hidden labels represent private organization state.",
        "",
      ].join("\n"),
    );

    const result = await indexProject({ projectRoot: root });

    expect(result.fileCount).toBe(2);
    expect(result.itemCount).toBe(2);
    expect(result.dbPath.endsWith("knowledge.sqlite")).toBe(true);

    const db = openReadOnlyDb(result.dbPath);

    const items = db
      .prepare("SELECT id, kind FROM items ORDER BY id")
      .all() as Array<{ id: string; kind: string }>;
    expect(items.map((i) => i.id).sort()).toEqual([
      "concept.label",
      "rules.labels.hidden-labels-stay-hidden",
    ]);

    const ruleStatus = db
      .prepare("SELECT status FROM rules WHERE id = ?")
      .get("rules.labels.hidden-labels-stay-hidden") as { status: string };
    expect(ruleStatus.status).toBe("active");

    const anchors = db
      .prepare("SELECT owner_id, kind, resolved, resolved_path FROM anchors")
      .all() as Array<{
      owner_id: string;
      kind: string;
      resolved: number;
      resolved_path: string | null;
    }>;
    expect(anchors.length).toBe(1);
    for (const a of anchors) {
      expect(a.resolved).toBe(1);
      expect(a.resolved_path).toContain("visibility.ts");
    }

    db.close();
  });

  test("produces broken-anchor status when symbol can't be resolved", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "rules", "x.md"),
      [
        "## Rule",
        "status: active",
        "reviewed: 2030-01-01",
        "anchors:",
        "  - symbol: DoesNotExist",
        "",
        "body",
        "",
      ].join("\n"),
    );

    const result = await indexProject({ projectRoot: root });
    const db = openReadOnlyDb(result.dbPath);
    const status = db
      .prepare("SELECT status FROM rules WHERE id = ?")
      .get("rules.x.rule") as { status: string };
    expect(status.status).toBe("broken-anchor");
    db.close();
  });

  test("is idempotent — re-indexing yields the same row counts", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "concepts", "a.md"),
      "---\nid: concept.a\ntitle: A\n---\n\nA.\n",
    );

    const r1 = await indexProject({ projectRoot: root });
    const r2 = await indexProject({ projectRoot: root });

    expect(r1.itemCount).toBe(1);
    expect(r2.itemCount).toBe(1);

    const db = openReadOnlyDb(r2.dbPath);
    const n = db.prepare("SELECT COUNT(*) as n FROM items").get() as {
      n: number;
    };
    expect(n.n).toBe(1);
    db.close();
  });
});
