import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { syncProject } from "../src/sync";
import { indexProject } from "../src/indexer";
import { openReadOnlyDb } from "../src/db";

async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), "know-sync-"));
  await mkdir(join(root, ".knowledge", "concepts"), { recursive: true });
  await mkdir(join(root, ".knowledge", "rules"), { recursive: true });
  return root;
}

describe("syncProject", () => {
  test("first run builds the index", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "concepts", "a.md"),
      "---\nid: concept.a\ntitle: A\n---\n\nA.\n",
    );

    const result = await syncProject({ projectRoot: root });
    expect(result.changed).toBe(true);
    expect(result.itemCount).toBe(1);

    const db = openReadOnlyDb(result.dbPath);
    const n = db.prepare("SELECT COUNT(*) as n FROM items").get() as {
      n: number;
    };
    expect(n.n).toBe(1);
    db.close();
  });

  test("no-ops when nothing changed", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "concepts", "a.md"),
      "---\nid: concept.a\ntitle: A\n---\n\nA.\n",
    );
    await indexProject({ projectRoot: root });

    const result = await syncProject({ projectRoot: root });
    expect(result.changed).toBe(false);
    expect(result.itemCount).toBe(1);
  });

  test("detects content edits and re-indexes", async () => {
    const root = await makeProject();
    const file = join(root, ".knowledge", "concepts", "a.md");
    await writeFile(file, "---\nid: concept.a\ntitle: A\n---\n\nA.\n");
    await indexProject({ projectRoot: root });

    await writeFile(file, "---\nid: concept.a\ntitle: A renamed\n---\n\nA.\n");
    const result = await syncProject({ projectRoot: root });
    expect(result.changed).toBe(true);

    const db = openReadOnlyDb(result.dbPath);
    const row = db
      .prepare("SELECT title FROM items WHERE id = ?")
      .get("concept.a") as { title: string };
    expect(row.title).toBe("A renamed");
    db.close();
  });

  test("detects added files", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "concepts", "a.md"),
      "---\nid: concept.a\ntitle: A\n---\n\nA.\n",
    );
    await indexProject({ projectRoot: root });

    await writeFile(
      join(root, ".knowledge", "concepts", "b.md"),
      "---\nid: concept.b\ntitle: B\n---\n\nB.\n",
    );

    const result = await syncProject({ projectRoot: root });
    expect(result.changed).toBe(true);
    expect(result.itemCount).toBe(2);
  });

  test("detects deleted files and drops their rows", async () => {
    const root = await makeProject();
    const fileA = join(root, ".knowledge", "concepts", "a.md");
    const fileB = join(root, ".knowledge", "concepts", "b.md");
    await writeFile(fileA, "---\nid: concept.a\ntitle: A\n---\n\nA.\n");
    await writeFile(fileB, "---\nid: concept.b\ntitle: B\n---\n\nB.\n");
    await indexProject({ projectRoot: root });

    await rm(fileB);

    const result = await syncProject({ projectRoot: root });
    expect(result.changed).toBe(true);

    const db = openReadOnlyDb(result.dbPath);
    const ids = (
      db.prepare("SELECT id FROM items ORDER BY id").all() as Array<{
        id: string;
      }>
    ).map((r) => r.id);
    expect(ids).toEqual(["concept.a"]);
    db.close();
  });
});
