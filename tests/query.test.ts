import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { indexProject } from "../src/indexer";
import { runQuery, describeSchema } from "../src/query";

async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), "know-query-"));
  await mkdir(join(root, ".knowledge", "concepts"), { recursive: true });
  return root;
}

describe("runQuery", () => {
  test("runs arbitrary SQL and returns rows", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "concepts", "a.md"),
      "---\nid: concept.a\ntitle: A\n---\n\nA.\n",
    );
    const result = await indexProject({ projectRoot: root });

    const out = runQuery({
      dbPath: result.dbPath,
      sql: "SELECT id, kind FROM items ORDER BY id",
    });

    expect(out.columns).toEqual(["id", "kind"]);
    expect(out.rows).toEqual([{ id: "concept.a", kind: "concept" }]);
  });

  test("rejects write statements", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "concepts", "a.md"),
      "---\nid: concept.a\ntitle: A\n---\n\nA.\n",
    );
    const result = await indexProject({ projectRoot: root });

    expect(() =>
      runQuery({
        dbPath: result.dbPath,
        sql: "INSERT INTO items(id,kind,path,body,frontmatter_json,content_hash) VALUES('x','x','x','x','{}','x')",
      }),
    ).toThrow();
  });
});

describe("describeSchema", () => {
  test("returns CREATE TABLE statements for all tables", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "concepts", "a.md"),
      "---\nid: concept.a\ntitle: A\n---\n\nA.\n",
    );
    const result = await indexProject({ projectRoot: root });

    const schema = describeSchema(result.dbPath);
    expect(schema).toContain("items");
    expect(schema).toContain("rules");
    expect(schema).toContain("anchors");
    expect(schema).toContain("links");
    expect(schema).toContain("rationale TEXT");
    expect(schema).toMatch(/CREATE TABLE/i);
  });
});
