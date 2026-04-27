import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "tinyglobby";
import type { AnchorKind, AnchorSpec } from "./parser";
import type Parser from "web-tree-sitter";

type WebTreeSitterModule = {
  default: typeof Parser;
};

export interface ResolveContext {
  projectRoot: string;
  /** Globs (project-relative) for files to scan when resolving symbol anchors. */
  sourceGlobs?: string[];
  /** Globs (project-relative) to exclude from symbol scans. */
  ignoreGlobs?: string[];
}

export interface ResolvedAnchor {
  kind: AnchorKind;
  value: string;
  resolved: boolean;
  resolvedPath?: string;
  fileHash?: string;
  fileMtime?: string;
}

const DEFAULT_SOURCE_GLOBS = [
  "**/*.ts",
  "**/*.tsx",
  "**/*.js",
  "**/*.jsx",
  "**/*.mjs",
  "**/*.cjs",
];
const DEFAULT_IGNORE_GLOBS = [
  "node_modules/**",
  "dist/**",
  "build/**",
  ".knowledge/**",
  ".yarn/**",
  ".git/**",
  "coverage/**",
];

export async function resolveAnchor(
  spec: AnchorSpec,
  ctx: ResolveContext,
): Promise<ResolvedAnchor[]> {
  switch (spec.kind) {
    case "path":
      return [await resolvePath(spec.value, ctx)];
    case "glob":
      return resolveGlob(spec.value, ctx);
    case "symbol":
      return [await resolveSymbol(spec.value, ctx)];
  }
}

async function resolvePath(
  value: string,
  ctx: ResolveContext,
): Promise<ResolvedAnchor> {
  const abs = isAbsolute(value) ? value : join(ctx.projectRoot, value);
  try {
    const stats = await stat(abs);
    if (!stats.isFile()) {
      return unresolved("path", value);
    }
    return {
      kind: "path",
      value,
      resolved: true,
      resolvedPath: abs,
      fileHash: await hashFile(abs),
      fileMtime: stats.mtime.toISOString(),
    };
  } catch {
    return unresolved("path", value);
  }
}

async function resolveGlob(
  value: string,
  ctx: ResolveContext,
): Promise<ResolvedAnchor[]> {
  const matches = await glob([value], {
    cwd: ctx.projectRoot,
    onlyFiles: true,
    absolute: true,
    ignore: ctx.ignoreGlobs ?? DEFAULT_IGNORE_GLOBS,
  });

  if (matches.length === 0) {
    return [unresolved("glob", value)];
  }

  return Promise.all(
    matches.sort().map(async (abs) => {
      const stats = await stat(abs);
      return {
        kind: "glob" as const,
        value,
        resolved: true,
        resolvedPath: abs,
        fileHash: await hashFile(abs),
        fileMtime: stats.mtime.toISOString(),
      };
    }),
  );
}

async function resolveSymbol(
  value: string,
  ctx: ResolveContext,
): Promise<ResolvedAnchor> {
  const sourceGlobs = ctx.sourceGlobs ?? DEFAULT_SOURCE_GLOBS;
  const ignoreGlobs = ctx.ignoreGlobs ?? DEFAULT_IGNORE_GLOBS;

  const files = await glob(sourceGlobs, {
    cwd: ctx.projectRoot,
    onlyFiles: true,
    absolute: true,
    ignore: ignoreGlobs,
  });

  for (const file of files) {
    if (await fileContainsSymbol(file, value)) {
      const stats = await stat(file);
      return {
        kind: "symbol",
        value,
        resolved: true,
        resolvedPath: file,
        fileHash: await hashFile(file),
        fileMtime: stats.mtime.toISOString(),
      };
    }
  }

  return unresolved("symbol", value);
}

function unresolved(kind: AnchorKind, value: string): ResolvedAnchor {
  return { kind, value, resolved: false };
}

async function hashFile(path: string): Promise<string> {
  const buf = await readFile(path);
  return createHash("sha256").update(buf).digest("hex");
}

// --- Symbol search via tree-sitter --------------------------------------

type LangKey = "typescript" | "tsx" | "javascript";

const langForExt: Record<string, LangKey> = {
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
};

const wasmFileFor: Record<LangKey, string> = {
  typescript: "tree-sitter-wasms/out/tree-sitter-typescript.wasm",
  tsx: "tree-sitter-wasms/out/tree-sitter-tsx.wasm",
  javascript: "tree-sitter-wasms/out/tree-sitter-javascript.wasm",
};

const wasmBasenameFor: Record<LangKey, string> = {
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  javascript: "tree-sitter-javascript.wasm",
};

let parserInitPromise: Promise<void> | null = null;
let parserModulePromise: Promise<WebTreeSitterModule> | null = null;
const languageCache = new Map<LangKey, Promise<Parser.Language>>();
const parserCache = new Map<LangKey, Parser>();

async function ensureParser(): Promise<void> {
  const parserModule = await getParserModule();
  if (!parserInitPromise) {
    parserInitPromise = parserModule.default.init();
  }
  await parserInitPromise;
}

async function getParser(lang: LangKey): Promise<Parser> {
  await ensureParser();
  const parserModule = await getParserModule();
  const ParserCtor = parserModule.default;

  let langPromise = languageCache.get(lang);
  if (!langPromise) {
    langPromise = resolveWasmBytes(lang).then((buf) =>
      ParserCtor.Language.load(new Uint8Array(buf)),
    );
    languageCache.set(lang, langPromise);
  }

  let parser = parserCache.get(lang);
  if (parser === undefined) {
    const createdParser = new ParserCtor();
    createdParser.setLanguage(await langPromise);
    parserCache.set(lang, createdParser);
    parser = createdParser;
  }
  return parser;
}

async function getParserModule(): Promise<WebTreeSitterModule> {
  if (!parserModulePromise) {
    parserModulePromise =
      import("web-tree-sitter") as Promise<WebTreeSitterModule>;
  }
  return parserModulePromise;
}

async function resolveWasmBytes(lang: LangKey): Promise<Buffer> {
  const bundledWasmPath = fileURLToPath(
    new URL(`./tree-sitter-wasms/${wasmBasenameFor[lang]}`, import.meta.url),
  );

  try {
    return await readFile(bundledWasmPath);
  } catch {
    const require = createRequire(import.meta.url);
    const packageWasmPath = require.resolve(wasmFileFor[lang]);
    return readFile(packageWasmPath);
  }
}

async function fileContainsSymbol(
  filePath: string,
  symbol: string,
): Promise<boolean> {
  const lang = langForExt[extname(filePath)];
  if (!lang) return false;

  const source = await readFile(filePath, "utf8");
  // Cheap pre-filter: if the literal name doesn't appear at all, skip parsing.
  const baseName = symbol.split(".")[0];
  if (!source.includes(baseName)) return false;

  const parser = await getParser(lang);
  const tree = parser.parse(source);
  if (!tree) return false;

  return findSymbol(tree.rootNode, symbol);
}

interface TSNode {
  type: string;
  text: string;
  childCount: number;
  child(i: number): TSNode | null;
  childForFieldName(name: string): TSNode | null;
}

function findSymbol(root: TSNode, symbol: string): boolean {
  const parts = symbol.split(".");

  if (parts.length === 1) {
    return findTopLevelSymbol(root, parts[0]);
  }

  // Class.method form. Find the class, then look for the method inside it.
  const [className, methodName] = parts;
  return findClassMethod(root, className, methodName);
}

function findTopLevelSymbol(node: TSNode, name: string): boolean {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;

    if (declarationName(child) === name) return true;

    // Descend into export/declaration wrappers.
    if (
      child.type === "export_statement" ||
      child.type === "lexical_declaration" ||
      child.type === "variable_declaration"
    ) {
      if (findTopLevelSymbol(child, name)) return true;
    }
  }
  return false;
}

function findClassMethod(
  node: TSNode,
  className: string,
  methodName: string,
): boolean {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;

    if (
      (child.type === "class_declaration" ||
        child.type === "abstract_class_declaration") &&
      identifierName(child) === className
    ) {
      const body = child.childForFieldName("body");
      if (body && classBodyContainsMethod(body, methodName)) return true;
    }

    if (
      child.type === "export_statement" ||
      child.type === "lexical_declaration" ||
      child.type === "variable_declaration"
    ) {
      if (findClassMethod(child, className, methodName)) return true;
    }
  }
  return false;
}

function classBodyContainsMethod(body: TSNode, methodName: string): boolean {
  for (let i = 0; i < body.childCount; i++) {
    const member = body.child(i);
    if (!member) continue;
    if (
      member.type === "method_definition" ||
      member.type === "method_signature" ||
      member.type === "abstract_method_signature"
    ) {
      const nameNode = member.childForFieldName("name");
      if (nameNode && nameNode.text === methodName) return true;
    }
  }
  return false;
}

function declarationName(node: TSNode): string | undefined {
  switch (node.type) {
    case "function_declaration":
    case "class_declaration":
    case "abstract_class_declaration":
    case "interface_declaration":
    case "type_alias_declaration":
    case "enum_declaration":
      return identifierName(node);
    case "variable_declarator": {
      const nameNode = node.childForFieldName("name");
      return nameNode?.text;
    }
    default:
      return undefined;
  }
}

function identifierName(node: TSNode): string | undefined {
  return node.childForFieldName("name")?.text;
}
