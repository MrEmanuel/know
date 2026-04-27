import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { indexProject } from "../src/indexer";
import { renderContext, getContext } from "../src/context";

async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), "know-context-"));
  await mkdir(join(root, ".knowledge", "concepts"), { recursive: true });
  await mkdir(join(root, ".knowledge", "rules"), { recursive: true });
  await mkdir(join(root, "src", "labels"), { recursive: true });
  return root;
}

describe("getContext", () => {
  test("returns matching rules plus concepts and rationale reached through those rules", async () => {
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
      ].join("\n"),
    );

    await writeFile(
      join(root, ".knowledge", "rules", "labels.md"),
      [
        "## Hidden stays hidden",
        "status: active",
        "reviewed: 2030-01-01",
        "concept: concept.label",
        "anchors:",
        "  - symbol: LabelVisibility",
        "",
        "Hidden labels stay hidden.",
        "",
        "### Rationale",
        "",
        "Hidden labels are part of private organization state.",
        "",
        "## Stale rule",
        "status: active",
        "reviewed: 2000-01-01",
        "concept: concept.label",
        "anchors:",
        "  - symbol: LabelVisibility",
        "",
        "Stale because it's old.",
        "",
        "### Rationale",
        "",
        "Old rule still needs a reason.",
        "",
        "## Broken rule",
        "status: active",
        "reviewed: 2030-01-01",
        "concept: concept.label",
        "anchors:",
        "  - symbol: DoesNotExist",
        "",
        "Broken anchor.",
        "",
      ].join("\n"),
    );

    const result = await indexProject({ projectRoot: root });
    const ctx = getContext({
      dbPath: result.dbPath,
      projectRoot: root,
      targetPath: "src/labels/visibility.ts",
    });

    expect(ctx.targetPath).toBe("src/labels/visibility.ts");

    const activeIds = ctx.activeRules.map((r) => r.id);
    expect(activeIds).toContain("rules.labels.hidden-stays-hidden");
    expect(activeIds).not.toContain("rules.labels.stale-rule");
    expect(activeIds).not.toContain("rules.labels.broken-rule");

    const staleIds = ctx.staleRules.map((r) => r.id);
    expect(staleIds).toContain("rules.labels.stale-rule");

    const conceptIds = ctx.concepts.map((c) => c.id);
    expect(conceptIds).toContain("concept.label");

    expect(ctx.activeRules[0].rationale).toBe(
      "Hidden labels are part of private organization state.",
    );
    expect(ctx.staleRules[0].rationale).toBe("Old rule still needs a reason.");

    expect(
      ctx.brokenAnchors.some((a) => a.ownerId === "rules.labels.broken-rule"),
    ).toBe(true);
  });

  test("does not return directly anchored concepts unless a rule matches the path", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, "src", "labels", "visibility.ts"),
      "export class LabelVisibility {}\n",
    );
    await writeFile(
      join(root, ".knowledge", "concepts", "label.md"),
      [
        "---",
        "id: concept.label",
        "title: Label",
        "anchors:",
        "  - symbol: LabelVisibility",
        "---",
        "",
        "Labels classify items.",
        "",
      ].join("\n"),
    );

    const result = await indexProject({ projectRoot: root });
    const ctx = getContext({
      dbPath: result.dbPath,
      projectRoot: root,
      targetPath: "src/labels/visibility.ts",
    });

    expect(ctx.activeRules).toEqual([]);
    expect(ctx.concepts).toEqual([]);
  });

  test("returns empty sections for a path with no knowledge", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "concepts", "a.md"),
      "---\nid: concept.a\ntitle: A\n---\n\nA.\n",
    );
    const result = await indexProject({ projectRoot: root });

    const ctx = getContext({
      dbPath: result.dbPath,
      projectRoot: root,
      targetPath: "src/unrelated.ts",
    });

    expect(ctx.activeRules).toEqual([]);
    expect(ctx.staleRules).toEqual([]);
    expect(ctx.concepts).toEqual([]);
    expect(ctx.brokenAnchors).toEqual([]);
  });
});

describe("renderContext", () => {
  test("renders Markdown with the documented section headings", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, "src", "labels", "visibility.ts"),
      "export class LabelVisibility {}\n",
    );
    await writeFile(
      join(root, ".knowledge", "rules", "labels.md"),
      [
        "## Hidden stays hidden",
        "status: active",
        "reviewed: 2030-01-01",
        "anchors:",
        "  - symbol: LabelVisibility",
        "",
        "Hidden labels stay hidden.",
        "",
      ].join("\n"),
    );

    const result = await indexProject({ projectRoot: root });
    const ctx = getContext({
      dbPath: result.dbPath,
      projectRoot: root,
      targetPath: "src/labels/visibility.ts",
    });
    const md = renderContext(ctx);

    expect(md).toContain("# Knowledge for src/labels/visibility.ts");
    expect(md).toContain("## Active rules");
    expect(md).toContain("Hidden stays hidden");
    expect(md).toContain("Hidden labels stay hidden");
  });

  test("renders '(none)' for empty broken anchors section", async () => {
    const root = await makeProject();
    await writeFile(
      join(root, ".knowledge", "concepts", "a.md"),
      "---\nid: concept.a\ntitle: A\n---\n\nA.\n",
    );
    const result = await indexProject({ projectRoot: root });

    const ctx = getContext({
      dbPath: result.dbPath,
      projectRoot: root,
      targetPath: "src/x.ts",
    });
    const md = renderContext(ctx);

    expect(md).toContain("## Broken anchors");
    expect(md).toContain("(none)");
  });
});
