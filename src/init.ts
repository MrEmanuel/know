import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
}

export interface InitKnowledgeProjectResult {
  root: string;
  directories: string[];
}

const generatedIndexIgnoreRule = "indexes/";
const defaultKnowledgeGitignore = `# Generated knowledge indexes\n${generatedIndexIgnoreRule}\n`;

export async function initKnowledgeProject(
  options: InitKnowledgeProjectOptions = {},
): Promise<InitKnowledgeProjectResult> {
  const cwd = options.cwd ?? process.cwd();
  const root = join(cwd, KNOWLEDGE_ROOT);
  const directories = KNOWLEDGE_DIRECTORIES.map((directory) =>
    join(root, directory),
  );

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
