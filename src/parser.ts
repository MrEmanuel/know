import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, relative, sep } from "node:path";
import { parse as parseYaml } from "yaml";

export type KnowledgeFileKind = "concept" | "rules";
export type KnowledgeItemKind = "concept" | "rule";
export type AnchorKind = "symbol" | "path" | "glob";

export interface AnchorSpec {
  kind: AnchorKind;
  value: string;
}

export interface ParsedItem {
  id: string;
  kind: KnowledgeItemKind;
  title?: string;
  status?: string;
  reviewed?: string;
  body: string;
  rationale?: string;
  anchors: AnchorSpec[];
  frontmatter: Record<string, unknown>;
}

export type LinkRelation = "wiki" | "related" | "concept";

export interface ParsedLink {
  from: string;
  to: string;
  relation: LinkRelation;
}

export interface ParsedFile {
  path: string;
  kind: KnowledgeFileKind;
  items: ParsedItem[];
  links: ParsedLink[];
  contentHash: string;
  raw: string;
}

export class KnowledgeParseError extends Error {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "KnowledgeParseError";
  }
}

export async function parseKnowledgeFile(
  path: string,
  knowledgeRoot: string,
): Promise<ParsedFile> {
  const raw = await readFile(path, "utf8");
  const kind = inferFileKind(path, knowledgeRoot);
  const { frontmatter, body } = splitFrontmatter(raw, path);

  const links: ParsedLink[] = [];
  let items: ParsedItem[];

  if (kind === "rules") {
    items = parseRulesBody(body, frontmatter, path, knowledgeRoot, links);
  } else {
    const item = parseSingleItem(kind, body, frontmatter, path, links);
    items = [item];
  }

  return {
    path,
    kind,
    items,
    links,
    contentHash: hashString(raw),
    raw,
  };
}

function inferFileKind(path: string, knowledgeRoot: string): KnowledgeFileKind {
  const rel = relative(knowledgeRoot, path).split(sep);
  const top = rel[0];
  switch (top) {
    case "concepts":
      return "concept";
    case "rules":
      return "rules";
    default:
      throw new KnowledgeParseError(
        `Unknown knowledge folder "${top}". Expected concepts/ or rules/.`,
        path,
      );
  }
}

interface FrontmatterSplit {
  frontmatter: Record<string, unknown>;
  body: string;
}

function splitFrontmatter(raw: string, path: string): FrontmatterSplit {
  if (!raw.startsWith("---")) {
    return { frontmatter: {}, body: raw };
  }

  const lines = raw.split(/\r?\n/);
  // first line is "---"
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: {}, body: raw };
  }

  const yamlText = lines.slice(1, endIndex).join("\n");
  const parsed = parseYaml(yamlText);
  if (parsed !== null && typeof parsed !== "object") {
    throw new KnowledgeParseError("Frontmatter must be a YAML mapping.", path);
  }
  const frontmatter = (parsed ?? {}) as Record<string, unknown>;
  const body = lines
    .slice(endIndex + 1)
    .join("\n")
    .replace(/^\n+/, "");
  return { frontmatter, body };
}

function parseSingleItem(
  kind: KnowledgeFileKind,
  body: string,
  frontmatter: Record<string, unknown>,
  path: string,
  links: ParsedLink[],
): ParsedItem {
  const itemKind: KnowledgeItemKind = kind === "rules" ? "rule" : kind;
  const { title, body: bodyAfterTitle } = extractH1(body);
  const id = resolveId(frontmatter, kind, path);

  const item: ParsedItem = {
    id,
    kind: itemKind,
    title: typeof frontmatter.title === "string" ? frontmatter.title : title,
    status:
      typeof frontmatter.status === "string" ? frontmatter.status : undefined,
    reviewed:
      typeof frontmatter.reviewed === "string"
        ? frontmatter.reviewed
        : undefined,
    body: bodyAfterTitle.trim(),
    anchors: extractAnchors(frontmatter, path),
    frontmatter,
  };

  collectLinksFromFrontmatter(id, frontmatter, links);
  collectWikilinksFromBody(id, item.body, links);

  return item;
}

function parseRulesBody(
  body: string,
  fileFrontmatter: Record<string, unknown>,
  path: string,
  knowledgeRoot: string,
  links: ParsedLink[],
): ParsedItem[] {
  const fileSlug = basename(path, ".md");
  const sections = splitOnH2(body);
  const items: ParsedItem[] = [];

  for (const section of sections) {
    const { metadata, body: prose } = splitRuleSection(section.body, path);
    const { statement, rationale } = splitRationale(prose);
    const slug = slugify(section.heading);
    const id = `rules.${fileSlug}.${slug}`;

    const anchors = extractAnchors(metadata, path);

    const item: ParsedItem = {
      id,
      kind: "rule",
      title: section.heading,
      status: typeof metadata.status === "string" ? metadata.status : undefined,
      reviewed:
        typeof metadata.reviewed === "string" ? metadata.reviewed : undefined,
      body: statement.trim(),
      rationale: rationale?.trim(),
      anchors,
      frontmatter: { ...fileFrontmatter, ...metadata },
    };

    collectLinksFromFrontmatter(id, item.frontmatter, links);
    collectWikilinksFromBody(id, item.body, links);
    items.push(item);
  }

  return items;
}

interface H2Section {
  heading: string;
  body: string;
}

function splitOnH2(body: string): H2Section[] {
  const lines = body.split(/\r?\n/);
  const sections: H2Section[] = [];
  let current: H2Section | null = null;

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[1], body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }

  if (current) sections.push(current);
  return sections;
}

function splitRuleSection(
  sectionBody: string,
  path: string,
): { metadata: Record<string, unknown>; body: string } {
  const lines = sectionBody.split(/\r?\n/);
  // Strip a leading blank line if present (from heading newline).
  while (lines.length > 0 && lines[0] === "") lines.shift();

  // Metadata runs from start until the first blank line.
  let metaEnd = lines.findIndex((l) => l === "");
  if (metaEnd === -1) metaEnd = lines.length;

  const metaLines = lines.slice(0, metaEnd);
  const bodyLines = lines.slice(metaEnd + 1);

  let metadata: Record<string, unknown> = {};
  if (metaLines.length > 0) {
    const parsed = parseYaml(metaLines.join("\n"));
    if (parsed !== null && typeof parsed !== "object") {
      throw new KnowledgeParseError(
        "Rule metadata must be a YAML mapping.",
        path,
      );
    }
    metadata = (parsed ?? {}) as Record<string, unknown>;
  }

  return { metadata, body: bodyLines.join("\n") };
}

function splitRationale(body: string): {
  statement: string;
  rationale?: string;
} {
  const lines = body.split(/\r?\n/);
  const rationaleIndex = lines.findIndex((line) =>
    /^###\s+Rationale\s*$/i.test(line),
  );

  if (rationaleIndex === -1) {
    return { statement: body };
  }

  const statement = lines.slice(0, rationaleIndex).join("\n");
  const rationale = lines.slice(rationaleIndex + 1).join("\n");
  return { statement, rationale };
}

function extractH1(body: string): { title?: string; body: string } {
  const lines = body.split(/\r?\n/);
  while (lines.length > 0 && lines[0] === "") lines.shift();
  if (lines[0]?.startsWith("# ")) {
    const title = lines[0].slice(2).trim();
    return { title, body: lines.slice(1).join("\n") };
  }
  return { body: lines.join("\n") };
}

function extractAnchors(
  frontmatter: Record<string, unknown>,
  path: string,
): AnchorSpec[] {
  const raw = frontmatter.anchors;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new KnowledgeParseError("`anchors` must be a list.", path);
  }

  const anchors: AnchorSpec[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object") {
      throw new KnowledgeParseError(
        "Anchor entries must be mappings like `- symbol: name`.",
        path,
      );
    }
    const obj = entry as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length !== 1) {
      throw new KnowledgeParseError(
        "Each anchor must specify exactly one of `symbol`, `path`, or `glob`.",
        path,
      );
    }
    const [kind] = keys;
    if (kind !== "symbol" && kind !== "path" && kind !== "glob") {
      throw new KnowledgeParseError(
        `Unknown anchor kind "${kind}". Expected symbol, path, or glob.`,
        path,
      );
    }
    const value = obj[kind];
    if (typeof value !== "string" || value.length === 0) {
      throw new KnowledgeParseError(
        `Anchor \`${kind}\` must be a non-empty string.`,
        path,
      );
    }
    anchors.push({ kind, value });
  }
  return anchors;
}

function resolveId(
  frontmatter: Record<string, unknown>,
  kind: KnowledgeFileKind,
  path: string,
): string {
  if (typeof frontmatter.id === "string" && frontmatter.id.length > 0) {
    return frontmatter.id;
  }

  const slug = basename(path, ".md");
  switch (kind) {
    case "concept":
      return `concept.${slug}`;
    case "rules":
      // Rules files don't have a single id; this branch is only reached when
      // someone parses a rules file as a single item, which we never do.
      return `rules.${slug}`;
  }
}

function collectLinksFromFrontmatter(
  from: string,
  frontmatter: Record<string, unknown>,
  links: ParsedLink[],
): void {
  for (const relation of ["related", "concept"] as const) {
    const value = frontmatter[relation];
    if (value === undefined) continue;
    const targets = Array.isArray(value) ? value : [value];
    for (const target of targets) {
      if (typeof target === "string" && target.length > 0) {
        links.push({ from, to: target, relation });
      }
    }
  }
}

function collectWikilinksFromBody(
  from: string,
  body: string,
  links: ParsedLink[],
): void {
  const re = /\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const target = match[1].trim();
    if (target.length > 0) {
      links.push({ from, to: target, relation: "wiki" });
    }
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hashString(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
