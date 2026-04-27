import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { indexProject } from "../src/indexer";
import { getStatus, renderStatus } from "../src/status";

async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), "know-status-"));
  await mkdir(join(root, ".knowledge", "concepts"), { recursive: true });
  await mkdir(join(root, ".knowledge", "rules"), { recursive: true });
  await mkdir(join(root, "src"), { recursive: true });
  return root;
}

describe("getStatus", () => {
  test("counts items by kind and rules by status", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, "src", "x.ts"),
      "export class X { go() { return true } }\n",
    );
    await writeFile(
      join(root, ".knowledge", "concepts", "a.md"),
      "---\nid: concept.a\ntitle: A\n---\n\nA.\n",
    );
    await writeFile(
      join(root, ".knowledge", "rules", "r.md"),
      [
        "## Active",
        "status: active",
        "reviewed: 2030-01-01",
        "anchors:",
        "  - symbol: X",
        "",
        "active body",
        "",
        "## Stale",
        "status: active",
        "reviewed: 2000-01-01",
        "anchors:",
        "  - symbol: X",
        "",
        "stale body",
        "",
        "## Broken",
        "status: active",
        "reviewed: 2030-01-01",
        "anchors:",
        "  - symbol: DoesNotExist",
        "",
        "broken body",
        "",
      ].join("\n"),
    );

    const result = await indexProject({ projectRoot: root });
    const status = getStatus({ dbPath: result.dbPath });

    expect(status.concepts).toBe(1);
    expect(status.rules.active).toBe(1);
    expect(status.rules.stale).toBe(1);
    expect(status.rules.brokenAnchor).toBe(1);
    expect(status.rules.deprecated).toBe(0);
    expect(status.rules.total).toBe(3);
  });

  test("returns zeros for an empty project", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "concepts", "a.md"),
      "---\nid: concept.a\ntitle: A\n---\n\nA.\n",
    );
    const result = await indexProject({ projectRoot: root });
    const status = getStatus({ dbPath: result.dbPath });

    expect(status.rules.total).toBe(0);
    expect(status.concepts).toBe(1);
  });
});

describe("renderStatus", () => {
  test("formats counts as readable lines", () => {
    const md = renderStatus({
      concepts: 3,
      rules: { active: 5, stale: 1, brokenAnchor: 0, deprecated: 0, total: 6 },
    });
    expect(md).toContain("Rules: 6");
    expect(md).toContain("active: 5");
    expect(md).toContain("stale: 1");
    expect(md).toContain("broken-anchor: 0");
    expect(md).toContain("Concepts: 3");
    expect(md).not.toContain("Rationales:");
  });
});
