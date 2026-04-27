import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseKnowledgeFile } from "../src/parser";

async function makeKnowledgeDir() {
  const root = await mkdtemp(join(tmpdir(), "know-parser-"));
  const knowledgeRoot = join(root, ".knowledge");
  await mkdir(join(knowledgeRoot, "concepts"), { recursive: true });
  await mkdir(join(knowledgeRoot, "rules"), { recursive: true });
  return knowledgeRoot;
}

async function write(path: string, content: string) {
  await writeFile(path, content);
  return path;
}

describe("parseKnowledgeFile — concepts", () => {
  test("parses a concept file with frontmatter, body, anchors, and wikilinks", async () => {
    const knowledgeRoot = await makeKnowledgeDir();
    const path = await write(
      join(knowledgeRoot, "concepts", "label.md"),
      [
        "---",
        "id: concept.label",
        "title: Label",
        "status: active",
        "tags: [labels, items]",
        "related: [concept.item, concept.maturity]",
        "anchors:",
        "  - glob: src/labels/**",
        "  - symbol: LabelService",
        "reviewed: 2026-04-01",
        "---",
        "",
        "# Label",
        "",
        "A user-visible marker attached to items.",
        "",
        "Labels behave differently depending on item maturity",
        "(see [[concept.maturity]]).",
        "",
      ].join("\n"),
    );

    const parsed = await parseKnowledgeFile(path, knowledgeRoot);

    expect(parsed.kind).toBe("concept");
    expect(parsed.path).toBe(path);
    expect(parsed.items).toHaveLength(1);

    const [item] = parsed.items;
    expect(item.id).toBe("concept.label");
    expect(item.kind).toBe("concept");
    expect(item.title).toBe("Label");
    expect(item.status).toBe("active");
    expect(item.reviewed).toBe("2026-04-01");
    expect(item.body).toContain("A user-visible marker attached to items.");
    expect(item.anchors).toEqual([
      { kind: "glob", value: "src/labels/**" },
      { kind: "symbol", value: "LabelService" },
    ]);

    expect(parsed.links).toEqual(
      expect.arrayContaining([
        { from: "concept.label", to: "concept.item", relation: "related" },
        { from: "concept.label", to: "concept.maturity", relation: "related" },
        { from: "concept.label", to: "concept.maturity", relation: "wiki" },
      ]),
    );
  });

  test("derives id from filename when frontmatter omits it", async () => {
    const knowledgeRoot = await makeKnowledgeDir();
    const path = await write(
      join(knowledgeRoot, "concepts", "item.md"),
      ["---", "title: Item", "---", "", "# Item", "", "An item.", ""].join(
        "\n",
      ),
    );

    const parsed = await parseKnowledgeFile(path, knowledgeRoot);
    expect(parsed.items[0].id).toBe("concept.item");
  });
});

describe("parseKnowledgeFile — rules", () => {
  test("splits a rules file into one item per ## heading with inline rationale", async () => {
    const knowledgeRoot = await makeKnowledgeDir();
    const path = await write(
      join(knowledgeRoot, "rules", "labels.md"),
      [
        "---",
        "concept: concept.label",
        "---",
        "",
        "# Label rules",
        "",
        "## Personal labels are visible only to their creator",
        "status: active",
        "anchors:",
        "  - symbol: LabelService.visibleTo",
        "  - glob: src/labels/visibility.ts",
        "reviewed: 2026-04-01",
        "",
        "Regardless of item maturity, personal labels never leak to other users.",
        "",
        "### Rationale",
        "",
        "Personal labels are private organizational tools.",
        "",
        "## Personal labels are dropped on cross-user copy",
        "status: active",
        "anchors:",
        "  - symbol: copyDocument",
        "reviewed: 2026-04-12",
        "",
        "When user A duplicates an item owned by user B, personal labels are dropped.",
        "",
        "### Rationale",
        "",
        "Copying personal labels leaks another user's mental model.",
        "",
      ].join("\n"),
    );

    const parsed = await parseKnowledgeFile(path, knowledgeRoot);

    expect(parsed.kind).toBe("rules");
    expect(parsed.items).toHaveLength(2);

    const [first, second] = parsed.items;

    expect(first.kind).toBe("rule");
    expect(first.id).toBe(
      "rules.labels.personal-labels-are-visible-only-to-their-creator",
    );
    expect(first.title).toBe(
      "Personal labels are visible only to their creator",
    );
    expect(first.status).toBe("active");
    expect(first.reviewed).toBe("2026-04-01");
    expect(first.body).toContain("Regardless of item maturity");
    expect(first.body).not.toContain("### Rationale");
    expect(first.rationale).toBe(
      "Personal labels are private organizational tools.",
    );
    expect(first.anchors).toEqual([
      { kind: "symbol", value: "LabelService.visibleTo" },
      { kind: "glob", value: "src/labels/visibility.ts" },
    ]);

    expect(second.id).toBe(
      "rules.labels.personal-labels-are-dropped-on-cross-user-copy",
    );
    expect(second.anchors).toEqual([{ kind: "symbol", value: "copyDocument" }]);
    expect(second.rationale).toBe(
      "Copying personal labels leaks another user's mental model.",
    );

    expect(parsed.links).toEqual(
      expect.arrayContaining([
        {
          from: "rules.labels.personal-labels-are-visible-only-to-their-creator",
          to: "concept.label",
          relation: "concept",
        },
      ]),
    );
  });

  test("tolerates a rule with metadata but no body prose", async () => {
    const knowledgeRoot = await makeKnowledgeDir();
    const path = await write(
      join(knowledgeRoot, "rules", "labels.md"),
      ["# Label rules", "", "## Sample rule", "status: active", ""].join("\n"),
    );

    const parsed = await parseKnowledgeFile(path, knowledgeRoot);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].body).toBe("");
    expect(parsed.items[0].status).toBe("active");
  });
});
