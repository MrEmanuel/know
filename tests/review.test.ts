import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { indexProject } from "../src/indexer";
import { reviewRule } from "../src/review";
import { openReadOnlyDb } from "../src/db";

async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), "know-review-"));
  await mkdir(join(root, ".knowledge", "rules"), { recursive: true });
  await mkdir(join(root, "src"), { recursive: true });
  return root;
}

describe("reviewRule", () => {
  test("updates reviewed: in a multi-rule file and re-indexes", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, "src", "x.ts"),
      "export class X { go() { return true } }\n",
    );
    const rulesPath = join(root, ".knowledge", "rules", "labels.md");
    await writeFile(
      rulesPath,
      [
        "## Rule One",
        "status: active",
        "reviewed: 2000-01-01",
        "anchors:",
        "  - symbol: X",
        "",
        "First rule.",
        "",
        "## Rule Two",
        "status: active",
        "reviewed: 2000-01-01",
        "anchors:",
        "  - symbol: X",
        "",
        "Second rule.",
        "",
      ].join("\n"),
    );

    const indexResult = await indexProject({ projectRoot: root });

    const result = await reviewRule({
      projectRoot: root,
      ruleId: "rules.labels.rule-two",
      now: new Date("2030-06-15T10:00:00Z"),
    });

    expect(result.path).toBe(rulesPath);
    expect(result.reviewedAt).toBe("2030-06-15");

    const file = await readFile(rulesPath, "utf8");
    // Rule One should still have its old date.
    expect(file).toContain("## Rule One");
    expect(file.split("## Rule Two")[0]).toContain("reviewed: 2000-01-01");
    // Rule Two should now be 2030-06-15.
    expect(file.split("## Rule Two")[1]).toContain("reviewed: 2030-06-15");

    const db = openReadOnlyDb(indexResult.dbPath);
    const row = db
      .prepare("SELECT reviewed_at, status FROM rules WHERE id = ?")
      .get("rules.labels.rule-two") as { reviewed_at: string; status: string };
    expect(row.reviewed_at).toBe("2030-06-15");
    expect(row.status).toBe("active");
    db.close();
  });

  test("inserts reviewed: when missing", async () => {
    const root = await makeProject();
    const rulesPath = join(root, ".knowledge", "rules", "x.md");
    await writeFile(
      rulesPath,
      [
        "## Only",
        "status: active",
        "anchors:",
        "  - path: src/missing.ts",
        "",
        "body",
        "",
      ].join("\n"),
    );
    await indexProject({ projectRoot: root });

    await reviewRule({
      projectRoot: root,
      ruleId: "rules.x.only",
      now: new Date("2030-06-15T00:00:00Z"),
    });

    const file = await readFile(rulesPath, "utf8");
    expect(file).toContain("reviewed: 2030-06-15");
  });

  test("throws when rule id is unknown", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "rules", "x.md"),
      [
        "## Only",
        "status: active",
        "reviewed: 2030-01-01",
        "",
        "body",
        "",
      ].join("\n"),
    );
    await indexProject({ projectRoot: root });

    await expect(
      reviewRule({ projectRoot: root, ruleId: "rules.x.does-not-exist" }),
    ).rejects.toThrow(/unknown rule/i);
  });
});
