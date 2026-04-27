import { readFile, writeFile } from "node:fs/promises";
import { openReadOnlyDb } from "./db";
import { indexProject } from "./indexer";
import { slugify } from "./parser";

export interface ReviewRuleOptions {
  projectRoot: string;
  ruleId: string;
  /** Override the "today" timestamp. Defaults to `new Date()`. */
  now?: Date;
  knowledgeDir?: string;
}

export interface ReviewRuleResult {
  path: string;
  reviewedAt: string;
}

export async function reviewRule(
  options: ReviewRuleOptions,
): Promise<ReviewRuleResult> {
  const knowledgeDir = options.knowledgeDir ?? ".knowledge";
  const dbPath = `${options.projectRoot}/${knowledgeDir}/indexes/knowledge.sqlite`;

  const filePath = lookupRuleFile(dbPath, options.ruleId);
  if (!filePath) {
    throw new Error(`Unknown rule id: ${options.ruleId}`);
  }

  const reviewedAt = formatDate(options.now ?? new Date());
  const original = await readFile(filePath, "utf8");
  const updated = updateReviewedField(original, options.ruleId, reviewedAt);
  await writeFile(filePath, updated);

  await indexProject({ projectRoot: options.projectRoot, knowledgeDir });

  return { path: filePath, reviewedAt };
}

function lookupRuleFile(dbPath: string, ruleId: string): string | undefined {
  const db = openReadOnlyDb(dbPath);
  try {
    const row = db
      .prepare("SELECT path FROM items WHERE id = ? AND kind = 'rule'")
      .get(ruleId) as { path: string } | undefined;
    return row?.path;
  } finally {
    db.close();
  }
}

function formatDate(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Update (or insert) the `reviewed:` line for a single rule section in a
 * rules markdown file. The section is identified by matching the slug of
 * its `## heading` against the trailing segment of `ruleId`.
 */
function updateReviewedField(
  source: string,
  ruleId: string,
  reviewedAt: string,
): string {
  const targetSlug = ruleId.split(".").slice(2).join(".");
  const lines = source.split(/\r?\n/);
  const sections = locateSections(lines);

  for (const section of sections) {
    if (slugify(section.heading) !== targetSlug) continue;

    // Metadata runs from headingIndex+1 to first blank line within section.
    const metaStart = section.headingIndex + 1;
    let metaEnd = metaStart;
    while (metaEnd < section.endIndex && lines[metaEnd] !== "") {
      metaEnd += 1;
    }

    let updated = false;
    for (let i = metaStart; i < metaEnd; i += 1) {
      if (/^reviewed\s*:/i.test(lines[i])) {
        lines[i] = `reviewed: ${reviewedAt}`;
        updated = true;
        break;
      }
    }

    if (!updated) {
      // Insert at the end of the metadata block (before first blank line).
      lines.splice(metaEnd, 0, `reviewed: ${reviewedAt}`);
    }

    return lines.join("\n");
  }

  throw new Error(`Could not locate section for rule id: ${ruleId}`);
}

interface Section {
  heading: string;
  headingIndex: number;
  endIndex: number; // exclusive
}

function locateSections(lines: string[]): Section[] {
  const headings: Array<{ heading: string; index: number }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^##\s+(.+?)\s*$/.exec(lines[i]);
    if (m) headings.push({ heading: m[1], index: i });
  }
  return headings.map((h, idx) => ({
    heading: h.heading,
    headingIndex: h.index,
    endIndex:
      idx + 1 < headings.length ? headings[idx + 1].index : lines.length,
  }));
}
