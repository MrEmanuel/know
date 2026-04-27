import { join } from "node:path";
import { glob } from "tinyglobby";
import { resolveAnchor, type ResolveContext } from "./anchors";
import {
  writeIndex,
  type AnchorBinding,
  type IndexBundle,
  type IndexedFile,
} from "./db";
import { parseKnowledgeFile, type ParsedLink } from "./parser";

export interface IndexProjectOptions {
  /** Project root that contains a `.knowledge/` directory. */
  projectRoot: string;
  /**
   * Subdirectory under `projectRoot` that holds knowledge files.
   * Defaults to `.knowledge`.
   */
  knowledgeDir?: string;
  /**
   * Override the SQLite output path. Defaults to
   * `<knowledgeDir>/indexes/knowledge.sqlite`.
   */
  dbPath?: string;
}

export interface IndexResult {
  dbPath: string;
  fileCount: number;
  itemCount: number;
  anchorCount: number;
  brokenAnchorCount: number;
}

const KNOWLEDGE_GLOBS = ["concepts/**/*.md", "rules/**/*.md"];

export async function indexProject(
  options: IndexProjectOptions,
): Promise<IndexResult> {
  const knowledgeDir = options.knowledgeDir ?? ".knowledge";
  const knowledgeRoot = join(options.projectRoot, knowledgeDir);
  const dbPath =
    options.dbPath ?? join(knowledgeRoot, "indexes", "knowledge.sqlite");

  const matches = await glob(KNOWLEDGE_GLOBS, {
    cwd: knowledgeRoot,
    absolute: true,
    onlyFiles: true,
  });

  const files: IndexedFile[] = [];
  const anchors: AnchorBinding[] = [];
  const links: ParsedLink[] = [];

  const resolveCtx: ResolveContext = { projectRoot: options.projectRoot };

  for (const filePath of matches.sort()) {
    const parsed = await parseKnowledgeFile(filePath, knowledgeRoot);
    files.push({
      path: parsed.path,
      contentHash: parsed.contentHash,
      items: parsed.items,
    });
    links.push(...parsed.links);

    for (const item of parsed.items) {
      for (const spec of item.anchors) {
        const resolved = await resolveAnchor(spec, resolveCtx);
        anchors.push({ ownerId: item.id, spec, resolved });
      }
    }
  }

  const bundle: IndexBundle = {
    files,
    anchors,
    links,
    indexedAt: new Date().toISOString(),
  };

  await writeIndex(dbPath, bundle);

  let itemCount = 0;
  let brokenAnchorCount = 0;
  for (const file of files) itemCount += file.items.length;
  for (const binding of anchors) {
    if (
      binding.resolved.length === 0 ||
      binding.resolved.some((r) => !r.resolved)
    ) {
      brokenAnchorCount += 1;
    }
  }

  return {
    dbPath,
    fileCount: files.length,
    itemCount,
    anchorCount: anchors.length,
    brokenAnchorCount,
  };
}
