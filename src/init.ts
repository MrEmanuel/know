import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

export const KNOWLEDGE_ROOT = ".knowledge";

export const KNOWLEDGE_DIRECTORIES = [
  "concepts",
  "rules",
  "decisions",
  "evidence",
  "sources",
  "indexes",
  "schemas",
] as const;

export interface InitKnowledgeProjectOptions {
  cwd?: string;
  outDir?: string;
}

export interface InitKnowledgeProjectResult {
  root: string;
  directories: string[];
}

export class KnowledgeProjectAlreadyExistsError extends Error {
  constructor(root: string) {
    super(
      `Knowledge project already exists at ${root}. Overwrite, remove, and fix modes are not implemented yet.`,
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
  const directories = KNOWLEDGE_DIRECTORIES.map((directory) =>
    join(root, directory),
  );

  await ensureKnowledgeRootDoesNotExist(root);
  await mkdir(root, { recursive: true });
  await Promise.all(
    directories.map((directory) => mkdir(directory, { recursive: true })),
  );
  await ensureKnowledgeGitignore(root);

  return {
    root,
    directories,
  };
}

function resolveKnowledgeRoot(cwd: string, outDir?: string) {
  const target = resolve(cwd, outDir ?? ".");

  if (basename(target) === KNOWLEDGE_ROOT) {
    return target;
  }

  return join(target, KNOWLEDGE_ROOT);
}

async function ensureKnowledgeRootDoesNotExist(root: string) {
  try {
    await stat(root);
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
