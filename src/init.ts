import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
  installAgentInstructions,
  type AgentInstructionOperation,
} from "./agent-instructions";

export const KNOWLEDGE_ROOT = ".knowledge";

export const KNOWLEDGE_DIRECTORIES = [
  "concepts",
  "rules",
  "indexes",
] as const;

export interface InitKnowledgeProjectOptions {
  cwd?: string;
  outDir?: string;
  agentFiles?: boolean;
  dryRun?: boolean;
}

export interface InitKnowledgeProjectResult {
  root: string;
  projectRoot: string;
  directories: string[];
  agentInstructions: AgentInstructionOperation[];
  dryRun: boolean;
}

export class KnowledgeProjectAlreadyExistsError extends Error {
  constructor(root: string) {
    super(
      `Knowledge project path exists at ${root}, but it is not a directory.`,
    );
    this.name = "KnowledgeProjectAlreadyExistsError";
  }
}

const generatedIndexIgnoreRule = "indexes/";
const defaultKnowledgeGitignore = `# Generated knowledge indexes\n${generatedIndexIgnoreRule}\n`;

export async function initKnowledgeProject(
  options: InitKnowledgeProjectOptions = {},
): Promise<InitKnowledgeProjectResult> {
  const cwd = options.cwd ?? process.cwd();
  const root = resolveKnowledgeRoot(cwd, options.outDir);
  const projectRoot = dirname(root);
  const directories = KNOWLEDGE_DIRECTORIES.map((directory) =>
    join(root, directory),
  );

  if (!options.dryRun) {
    await ensureKnowledgeRootIsUsable(root);
    await mkdir(root, { recursive: true });
    await Promise.all(
      directories.map((directory) => mkdir(directory, { recursive: true })),
    );
    await ensureKnowledgeGitignore(root);
  }

  const agentInstructions = await installAgentInstructions({
    projectRoot,
    knowledgeRoot: root,
    agentFiles: options.agentFiles,
    dryRun: options.dryRun,
  });

  return {
    root,
    projectRoot,
    directories,
    agentInstructions,
    dryRun: options.dryRun ?? false,
  };
}

function resolveKnowledgeRoot(cwd: string, outDir?: string) {
  const target = resolve(cwd, outDir ?? ".");

  if (basename(target) === KNOWLEDGE_ROOT) {
    return target;
  }

  return join(target, KNOWLEDGE_ROOT);
}

async function ensureKnowledgeRootIsUsable(root: string) {
  try {
    const stats = await stat(root);

    if (stats.isDirectory()) {
      return;
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  throw new KnowledgeProjectAlreadyExistsError(root);
}

async function ensureKnowledgeGitignore(root: string) {
  const gitignorePath = join(root, ".gitignore");

  let current: string;

  try {
    current = await readFile(gitignorePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      await writeFile(gitignorePath, defaultKnowledgeGitignore);
      return;
    }

    throw error;
  }

  const rules = current.split(/\r?\n/);

  if (rules.includes(generatedIndexIgnoreRule)) {
    return;
  }

  const separator = current.endsWith("\n") || current.length === 0 ? "" : "\n";
  await writeFile(
    gitignorePath,
    `${current}${separator}${generatedIndexIgnoreRule}\n`,
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
