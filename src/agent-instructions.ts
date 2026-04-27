import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const KNOW_MANAGED_BLOCK_START = "<!-- know:start -->";
export const KNOW_MANAGED_BLOCK_END = "<!-- know:end -->";

export type AgentInstructionOperationAction =
  | "create"
  | "update"
  | "unchanged"
  | "skip";

export interface AgentInstructionOperation {
  path: string;
  action: AgentInstructionOperationAction;
  reason?: string;
}

export interface InstallAgentInstructionsOptions {
  projectRoot: string;
  knowledgeRoot: string;
  agentFiles?: boolean;
  dryRun?: boolean;
}

const agentInstructionsPath = "agent-instructions.md";

const agentsManagedBlock = managedBlock(`## Repository knowledge

This repository uses \`know\` for structured domain knowledge. The source of truth lives in \`.knowledge/\`; generated indexes live in \`.knowledge/indexes/\`.

Before editing any file, run:

    yarn know context <path>

Treat returned **active rules** as constraints on your change. If a rule is **stale**, read its rationale and either confirm it or propose a change.

Full workflow: \`.knowledge/agent-instructions.md\``);

const claudeManagedBlock = managedBlock(`## Repository knowledge

This repository uses \`know\` for structured domain knowledge.

Before editing any file, run \`yarn know context <path>\` and treat returned rules as constraints. For broader queries, use \`yarn know query "<sql>"\`.

Full workflow: \`.knowledge/agent-instructions.md\``);

const copilotManagedBlock = managedBlock(`## Repository knowledge

This repository uses \`know\` for structured domain knowledge.

Before editing any file, run \`yarn know context <path>\` and treat returned rules as constraints. For broader queries, use \`yarn know query "<sql>"\`.

Full workflow: \`.knowledge/agent-instructions.md\``);

const cursorManagedBlock = managedBlock(`This repository uses \`know\`.

Before editing any file, run \`yarn know context <path>\` and treat returned rules as constraints. For broader queries, use \`yarn know query "<sql>"\`.

Full workflow: \`.knowledge/agent-instructions.md\``);

const cursorNewFileContent = `---
description: Use know before non-trivial repository edits
alwaysApply: true
---

${cursorManagedBlock}`;

const canonicalAgentInstructions = `# know agent instructions

## Purpose

\`know\` captures domain rules, anchors, and rationale alongside the codebase. Knowledge lives in version-controlled Markdown files in \`.knowledge/\`; a generated SQLite database in \`.knowledge/indexes/\` makes it queryable.

## Before editing any file

Run:

\`\`\`bash
yarn know context <path>
\`\`\`

If this repository does not use Yarn, use the equivalent package-manager
invocation, such as \`npx know context <path>\` or
\`pnpm know context <path>\`.

This returns:

- **Active rules** whose anchors match the path — treat these as constraints.
- **Stale rules** — the anchored code changed since last review. Read the rationale and either confirm (update \`reviewed:\`) or propose a change.
- **Connected concepts** — optional vocabulary reached through matching rules.
- **Broken anchors** — the code a rule pointed at no longer exists. Flag it.

## Broader queries

\`\`\`bash
yarn know query "<sql>"     # read-only SQL against the index
yarn know query --schema    # print schema + example queries
\`\`\`

## Knowledge structure

- \`.knowledge/rules/\` — source of truth; each \`##\` section is a rule with anchors and rationale.
- \`.knowledge/concepts/\` — optional domain vocabulary reached from rule metadata.

## Rules for agents

- Always run \`yarn know context <path>\` before editing a file.
- Treat active rules as constraints on your change.
- Never write to \`.knowledge/indexes/knowledge.sqlite\`.
- Never edit generated files under \`.knowledge/indexes/\`.
- To add or update knowledge, edit \`.knowledge/*.md\` files only.
- After editing knowledge files, run \`yarn know index\` if available.
`;

interface OptionalAgentFile {
  relativePath: string;
  block: string;
  createContent?: string;
}

const optionalAgentFiles: OptionalAgentFile[] = [
  {
    relativePath: "CLAUDE.md",
    block: claudeManagedBlock,
  },
  {
    relativePath: join(".github", "copilot-instructions.md"),
    block: copilotManagedBlock,
  },
  {
    relativePath: join(".cursor", "rules", "know.mdc"),
    block: cursorManagedBlock,
    createContent: cursorNewFileContent,
  },
];

export async function installAgentInstructions({
  projectRoot,
  knowledgeRoot,
  agentFiles,
  dryRun = false,
}: InstallAgentInstructionsOptions): Promise<AgentInstructionOperation[]> {
  const operations: AgentInstructionOperation[] = [];

  operations.push(
    await writeWholeFile(
      join(knowledgeRoot, agentInstructionsPath),
      canonicalAgentInstructions,
      dryRun,
    ),
  );

  operations.push(
    await upsertManagedMarkdownFile(
      join(projectRoot, "AGENTS.md"),
      agentsManagedBlock,
      dryRun,
    ),
  );

  for (const optionalAgentFile of optionalAgentFiles) {
    const path = join(projectRoot, optionalAgentFile.relativePath);
    const existing = await readTextIfExists(path);

    if (agentFiles === false) {
      operations.push({
        path,
        action: "skip",
        reason: "agent-specific files disabled",
      });
      continue;
    }

    if (!existing.exists && agentFiles !== true) {
      operations.push({
        path,
        action: "skip",
        reason: "file does not exist",
      });
      continue;
    }

    operations.push(
      await upsertManagedMarkdownFile(
        path,
        optionalAgentFile.block,
        dryRun,
        existing,
        optionalAgentFile.createContent,
      ),
    );
  }

  return operations;
}

export function upsertManagedBlock(existing: string, block: string): string {
  const lineEnding = detectLineEnding(existing);
  const normalizedBlock = normalizeLineEndings(block, lineEnding);
  const pattern = new RegExp(
    `${escapeRegExp(KNOW_MANAGED_BLOCK_START)}[\\s\\S]*?${escapeRegExp(KNOW_MANAGED_BLOCK_END)}`,
    "m",
  );

  if (pattern.test(existing)) {
    return ensureFinalNewline(
      existing.replace(pattern, normalizedBlock),
      lineEnding,
    );
  }

  if (existing.length === 0) {
    return ensureFinalNewline(normalizedBlock, lineEnding);
  }

  return ensureFinalNewline(
    insertNearTop(existing, normalizedBlock, lineEnding),
    lineEnding,
  );
}

function managedBlock(content: string) {
  return `${KNOW_MANAGED_BLOCK_START}
${content}
${KNOW_MANAGED_BLOCK_END}`;
}

async function writeWholeFile(
  path: string,
  content: string,
  dryRun: boolean,
): Promise<AgentInstructionOperation> {
  const existing = await readTextIfExists(path);
  const lineEnding = existing.exists
    ? detectLineEnding(existing.content)
    : "\n";
  const next = ensureFinalNewline(
    normalizeLineEndings(content, lineEnding),
    lineEnding,
  );

  if (existing.exists && existing.content === next) {
    return { path, action: "unchanged" };
  }

  const action = existing.exists ? "update" : "create";

  if (!dryRun) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, next);
  }

  return { path, action };
}

async function upsertManagedMarkdownFile(
  path: string,
  block: string,
  dryRun: boolean,
  existing?: Awaited<ReturnType<typeof readTextIfExists>>,
  createContent?: string,
): Promise<AgentInstructionOperation> {
  existing ??= await readTextIfExists(path);

  const content = existing.exists ? existing.content : "";
  const next = existing.exists
    ? upsertManagedBlock(content, block)
    : ensureFinalNewline(createContent ?? block, "\n");

  if (existing.exists && existing.content === next) {
    return { path, action: "unchanged" };
  }

  const action = existing.exists ? "update" : "create";

  if (!dryRun) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, next);
  }

  return { path, action };
}

async function readTextIfExists(path: string) {
  try {
    return {
      exists: true as const,
      content: await readFile(path, "utf8"),
    };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        exists: false as const,
      };
    }

    throw error;
  }
}

function insertNearTop(
  markdown: string,
  block: string,
  lineEnding: string,
): string {
  const lines = markdown.split(/\r?\n/);

  if (lines[0]?.startsWith("# ")) {
    return [lines[0], "", block, "", ...lines.slice(1)].join(lineEnding);
  }

  if (lines[0] === "---") {
    const endIndex = lines.findIndex(
      (line, index) => index > 0 && line === "---",
    );

    if (endIndex !== -1) {
      return [
        ...lines.slice(0, endIndex + 1),
        "",
        block,
        "",
        ...lines.slice(endIndex + 1),
      ].join(lineEnding);
    }
  }

  return [block, "", markdown].join(lineEnding);
}

function detectLineEnding(text: string) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function normalizeLineEndings(text: string, lineEnding: string) {
  return text.replace(/\r?\n/g, lineEnding);
}

function ensureFinalNewline(text: string, lineEnding: string) {
  return text.endsWith("\n") ? text : `${text}${lineEnding}`;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
