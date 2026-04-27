import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { indexProject } from "../src/indexer";
import { getContext, renderContext } from "../src/context";
import { getStatus } from "../src/status";
import { runQuery } from "../src/query";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "fixtures", "product-maturity");

async function copyFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "know-fixture-"));
  await cp(FIXTURE, dir, {
    recursive: true,
    filter(source) {
      const relativePath = source.slice(FIXTURE.length).replace(/^\//, "");
      if (relativePath === "") return true;
      return !(
        relativePath === ".git" ||
        relativePath.startsWith(".git/") ||
        relativePath === "node_modules" ||
        relativePath.startsWith("node_modules/") ||
        relativePath === "package-lock.json" ||
        relativePath === ".knowledge/indexes" ||
        relativePath.startsWith(".knowledge/indexes/") ||
        relativePath === ".knowledge/agent-instructions.md" ||
        relativePath === "AGENTS.md" ||
        relativePath === "CLAUDE.md" ||
        relativePath === ".github" ||
        relativePath.startsWith(".github/") ||
        relativePath === ".cursor" ||
        relativePath.startsWith(".cursor/")
      );
    },
  });
  return dir;
}

describe("product-maturity end-to-end", () => {
  test("indexes the fixture and resolves all anchors", async () => {
    const root = await copyFixture();
    const result = await indexProject({ projectRoot: root });

    expect(result.fileCount).toBeGreaterThanOrEqual(3);
    expect(result.itemCount).toBeGreaterThanOrEqual(5);
    expect(result.brokenAnchorCount).toBe(0);
  });

  test("status shows three active rules and no broken anchors", async () => {
    const root = await copyFixture();
    const result = await indexProject({ projectRoot: root });
    const status = getStatus({ dbPath: result.dbPath });

    expect(status.rules.total).toBe(3);
    expect(status.rules.active).toBe(3);
    expect(status.rules.brokenAnchor).toBe(0);
    expect(status.concepts).toBe(2);
  });

  test("know context for visibility.ts surfaces the right rules and rationale", async () => {
    const root = await copyFixture();
    const result = await indexProject({ projectRoot: root });

    const ctx = getContext({
      dbPath: result.dbPath,
      projectRoot: root,
      targetPath: "src/labels/visibility.ts",
    });

    const ruleIds = ctx.activeRules.map((r) => r.id);
    expect(ruleIds).toContain("rules.labels.personal-visible-only-to-owner");
    expect(ruleIds).toContain("rules.labels.hidden-labels-stay-hidden");

    const personalRule = ctx.activeRules.find(
      (r) => r.id === "rules.labels.personal-visible-only-to-owner",
    );
    expect(personalRule?.rationale).toContain(
      "Personal labels are private organization state.",
    );

    const conceptIds = ctx.concepts.map((c) => c.id);
    expect(conceptIds).toContain("concept.label");

    const md = renderContext(ctx);
    expect(md).toContain("# Knowledge for src/labels/visibility.ts");
    expect(md).toContain("Personal visible only to owner");
  });

  test("know context for copy.ts surfaces the copy rule and its rationale", async () => {
    const root = await copyFixture();
    const result = await indexProject({ projectRoot: root });

    const ctx = getContext({
      dbPath: result.dbPath,
      projectRoot: root,
      targetPath: "src/labels/copy.ts",
    });

    const ruleIds = ctx.activeRules.map((r) => r.id);
    expect(ruleIds).toContain("rules.labels.copy-personal-not-followed");

    expect(ctx.activeRules[0].rationale).toContain(
      "Copying personal labels would expose another user's organization model.",
    );
  });

  test("know query returns rule rows by status", async () => {
    const root = await copyFixture();
    const result = await indexProject({ projectRoot: root });

    const out = runQuery({
      dbPath: result.dbPath,
      sql: "SELECT id FROM rules WHERE status = 'active' ORDER BY id",
    });

    expect(out.rows.map((r) => r.id)).toEqual([
      "rules.labels.copy-personal-not-followed",
      "rules.labels.hidden-labels-stay-hidden",
      "rules.labels.personal-visible-only-to-owner",
    ]);
  });
});
