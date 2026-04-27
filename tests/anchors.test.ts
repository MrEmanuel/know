import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { resolveAnchor } from "../src/anchors";

async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), "know-anchors-"));
  return root;
}

async function write(root: string, relPath: string, content: string) {
  const abs = join(root, relPath);
  await mkdir(join(abs, ".."), { recursive: true });
  await writeFile(abs, content);
  return abs;
}

describe("resolveAnchor — path", () => {
  test("resolves an existing file with hash", async () => {
    const root = await makeProject();
    await write(root, "src/labels/visibility.ts", "export const x = 1;\n");

    const [resolved] = await resolveAnchor(
      { kind: "path", value: "src/labels/visibility.ts" },
      { projectRoot: root },
    );

    expect(resolved.kind).toBe("path");
    expect(resolved.resolved).toBe(true);
    expect(resolved.resolvedPath).toBe(join(root, "src/labels/visibility.ts"));
    expect(resolved.fileHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("returns unresolved when file does not exist", async () => {
    const root = await makeProject();

    const [resolved] = await resolveAnchor(
      { kind: "path", value: "src/missing.ts" },
      { projectRoot: root },
    );

    expect(resolved.resolved).toBe(false);
    expect(resolved.resolvedPath).toBeUndefined();
    expect(resolved.fileHash).toBeUndefined();
  });
});

describe("resolveAnchor — glob", () => {
  test("expands a glob to one entry per matched file", async () => {
    const root = await makeProject();
    await write(root, "src/labels/visibility.ts", "// a\n");
    await write(root, "src/labels/list.ts", "// b\n");
    await write(root, "src/items/item.ts", "// c\n");

    const resolved = await resolveAnchor(
      { kind: "glob", value: "src/labels/**" },
      { projectRoot: root },
    );

    expect(resolved).toHaveLength(2);
    expect(resolved.every((r) => r.resolved)).toBe(true);
    const paths = resolved.map((r) => r.resolvedPath).sort();
    expect(paths).toEqual([
      join(root, "src/labels/list.ts"),
      join(root, "src/labels/visibility.ts"),
    ]);
    for (const r of resolved) {
      expect(r.fileHash).toMatch(/^[0-9a-f]{64}$/);
      expect(r.value).toBe("src/labels/**");
    }
  });

  test("returns one unresolved entry when nothing matches", async () => {
    const root = await makeProject();
    await write(root, "src/items/item.ts", "// c\n");

    const resolved = await resolveAnchor(
      { kind: "glob", value: "src/labels/**" },
      { projectRoot: root },
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0].resolved).toBe(false);
    expect(resolved[0].resolvedPath).toBeUndefined();
  });
});

describe("resolveAnchor — symbol", () => {
  test("finds a top-level class declaration in a TS file", async () => {
    const root = await makeProject();
    await write(
      root,
      "src/labels/service.ts",
      [
        "export class LabelService {",
        "  visibleTo(userId: string) { return true }",
        "}",
        "",
      ].join("\n"),
    );

    const [resolved] = await resolveAnchor(
      { kind: "symbol", value: "LabelService" },
      { projectRoot: root },
    );

    expect(resolved.resolved).toBe(true);
    expect(resolved.resolvedPath).toBe(join(root, "src/labels/service.ts"));
    expect(resolved.fileHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("finds a class method via Class.method", async () => {
    const root = await makeProject();
    await write(
      root,
      "src/labels/service.ts",
      [
        "export class LabelService {",
        "  visibleTo(userId: string) { return true }",
        "  list() { return [] }",
        "}",
        "",
      ].join("\n"),
    );

    const [resolved] = await resolveAnchor(
      { kind: "symbol", value: "LabelService.visibleTo" },
      { projectRoot: root },
    );

    expect(resolved.resolved).toBe(true);
    expect(resolved.resolvedPath).toBe(join(root, "src/labels/service.ts"));
  });

  test("finds a top-level function declaration", async () => {
    const root = await makeProject();
    await write(
      root,
      "src/items/copy.ts",
      ["export function copyDocument(id: string) {}", ""].join("\n"),
    );

    const [resolved] = await resolveAnchor(
      { kind: "symbol", value: "copyDocument" },
      { projectRoot: root },
    );

    expect(resolved.resolved).toBe(true);
    expect(resolved.resolvedPath).toBe(join(root, "src/items/copy.ts"));
  });

  test("returns unresolved when symbol is not found", async () => {
    const root = await makeProject();
    await write(root, "src/labels/service.ts", "export const x = 1;\n");

    const [resolved] = await resolveAnchor(
      { kind: "symbol", value: "DoesNotExist" },
      { projectRoot: root },
    );

    expect(resolved.resolved).toBe(false);
    expect(resolved.resolvedPath).toBeUndefined();
  });

  test("ignores .knowledge/ and node_modules/ when scanning", async () => {
    const root = await makeProject();
    await write(
      root,
      "node_modules/foo/src/lib.ts",
      "export class HiddenSymbol {}\n",
    );
    await write(
      root,
      ".knowledge/concepts/lib.ts",
      "export class HiddenSymbol {}\n",
    );

    const [resolved] = await resolveAnchor(
      { kind: "symbol", value: "HiddenSymbol" },
      { projectRoot: root },
    );

    expect(resolved.resolved).toBe(false);
  });
});
