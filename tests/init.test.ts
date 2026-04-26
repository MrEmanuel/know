import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { KNOW_MANAGED_BLOCK_START, initKnowledgeProject } from "../src";
import { runCli } from "../src/cli";

async function makeWorkspace() {
  return mkdtemp(join(tmpdir(), "know-init-"));
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function expectDirectory(path: string) {
  const stats = await stat(path);

  expect(stats.isDirectory()).toBe(true);
}

function countOccurrences(text: string, needle: string) {
  return text.split(needle).length - 1;
}

describe("initKnowledgeProject", () => {
  test("creates the knowledge source tree and keeps generated indexes out of git", async () => {
    const cwd = await makeWorkspace();

    await initKnowledgeProject({ cwd });

    await expectDirectory(join(cwd, ".knowledge", "concepts"));
    await expectDirectory(join(cwd, ".knowledge", "rules"));
    await expectDirectory(join(cwd, ".knowledge", "rationales"));
    await expectDirectory(join(cwd, ".knowledge", "indexes"));
    await expectDirectory(join(cwd, ".knowledge", "schemas"));

    await expect(
      pathExists(join(cwd, ".knowledge", "indexes", "knowledge.sqlite")),
    ).resolves.toBe(false);
    await expect(
      readFile(join(cwd, ".knowledge", ".gitignore"), "utf8"),
    ).resolves.toContain("indexes/");
  });

  test("creates the knowledge source tree in a requested output directory", async () => {
    const cwd = await makeWorkspace();

    await initKnowledgeProject({ cwd, outDir: "generated" });

    await expectDirectory(join(cwd, "generated", ".knowledge", "concepts"));
    await expectDirectory(join(cwd, "generated", ".knowledge", "rules"));
    await expect(pathExists(join(cwd, ".knowledge"))).resolves.toBe(false);
    await expect(pathExists(join(cwd, "generated", "AGENTS.md"))).resolves.toBe(
      true,
    );
  });

  test("accepts an output path that already ends in .knowledge", async () => {
    const cwd = await makeWorkspace();

    await initKnowledgeProject({
      cwd,
      outDir: join("generated", ".knowledge"),
    });

    await expectDirectory(join(cwd, "generated", ".knowledge", "concepts"));
    await expect(
      pathExists(join(cwd, "generated", ".knowledge", ".knowledge")),
    ).resolves.toBe(false);
    await expect(pathExists(join(cwd, "generated", "AGENTS.md"))).resolves.toBe(
      true,
    );
  });

  test("is idempotent when the knowledge project already exists", async () => {
    const cwd = await makeWorkspace();

    await initKnowledgeProject({ cwd });

    const gitignoreBefore = await readFile(
      join(cwd, ".knowledge", ".gitignore"),
      "utf8",
    );
    const agentsBefore = await readFile(join(cwd, "AGENTS.md"), "utf8");

    await initKnowledgeProject({ cwd });

    await expect(
      readFile(join(cwd, ".knowledge", ".gitignore"), "utf8"),
    ).resolves.toBe(gitignoreBefore);
    await expect(readFile(join(cwd, "AGENTS.md"), "utf8")).resolves.toBe(
      agentsBefore,
    );
  });

  test("preserves an existing knowledge gitignore while adding the generated index rule", async () => {
    const cwd = await makeWorkspace();
    const knowledgeRoot = join(cwd, ".knowledge");

    await mkdir(knowledgeRoot);
    await writeFile(join(knowledgeRoot, ".gitignore"), "custom-rule\n");

    await initKnowledgeProject({ cwd });

    const gitignore = await readFile(
      join(cwd, ".knowledge", ".gitignore"),
      "utf8",
    );
    expect(gitignore).toContain("custom-rule\n");
    expect(gitignore).toContain("indexes/\n");
  });

  test("creates canonical agent instructions in the knowledge tree", async () => {
    const cwd = await makeWorkspace();

    await initKnowledgeProject({ cwd });

    const instructions = await readFile(
      join(cwd, ".knowledge", "agent-instructions.md"),
      "utf8",
    );
    expect(instructions).toContain("# know agent instructions");
    expect(instructions).toContain("know context <path>");
    expect(instructions).toContain(".knowledge/rationales/");
  });

  test("creates AGENTS.md when missing", async () => {
    const cwd = await makeWorkspace();

    await initKnowledgeProject({ cwd });

    const agents = await readFile(join(cwd, "AGENTS.md"), "utf8");
    expect(agents).toContain(KNOW_MANAGED_BLOCK_START);
    expect(agents).toContain(
      "Full workflow: `.knowledge/agent-instructions.md`",
    );
  });

  test("inserts the managed block into an existing AGENTS.md with a title", async () => {
    const cwd = await makeWorkspace();

    await writeFile(
      join(cwd, "AGENTS.md"),
      "# Agents\n\nKeep this project note.\n",
    );

    await initKnowledgeProject({ cwd });

    const agents = await readFile(join(cwd, "AGENTS.md"), "utf8");
    expect(agents.startsWith("# Agents\n\n<!-- know:start -->")).toBe(true);
    expect(agents).toContain("Keep this project note.");
  });

  test("inserts the managed block after YAML frontmatter", async () => {
    const cwd = await makeWorkspace();

    await writeFile(
      join(cwd, "AGENTS.md"),
      "---\nowner: platform\n---\n\nKeep this project note.\n",
    );

    await initKnowledgeProject({ cwd });

    const agents = await readFile(join(cwd, "AGENTS.md"), "utf8");
    expect(
      agents.startsWith("---\nowner: platform\n---\n\n<!-- know:start -->"),
    ).toBe(true);
    expect(agents).toContain("Keep this project note.");
  });

  test("replaces an existing managed block without duplicating it", async () => {
    const cwd = await makeWorkspace();

    await writeFile(
      join(cwd, "AGENTS.md"),
      [
        "# Agents",
        "",
        "<!-- know:start -->",
        "old know instructions",
        "<!-- know:end -->",
        "",
        "Keep this project note.",
        "",
      ].join("\n"),
    );

    await initKnowledgeProject({ cwd });

    const agents = await readFile(join(cwd, "AGENTS.md"), "utf8");
    expect(countOccurrences(agents, "<!-- know:start -->")).toBe(1);
    expect(countOccurrences(agents, "<!-- know:end -->")).toBe(1);
    expect(agents).not.toContain("old know instructions");
    expect(agents).toContain("Keep this project note.");
  });

  test("updates existing optional agent files without creating missing ones by default", async () => {
    const cwd = await makeWorkspace();

    await writeFile(
      join(cwd, "CLAUDE.md"),
      "# Claude\n\nProject-specific guidance.\n",
    );

    await initKnowledgeProject({ cwd });

    const claude = await readFile(join(cwd, "CLAUDE.md"), "utf8");
    expect(claude).toContain(KNOW_MANAGED_BLOCK_START);
    expect(claude).toContain("Project-specific guidance.");
    await expect(
      pathExists(join(cwd, ".github", "copilot-instructions.md")),
    ).resolves.toBe(false);
    await expect(
      pathExists(join(cwd, ".cursor", "rules", "know.mdc")),
    ).resolves.toBe(false);
  });

  test("creates parent directories for optional agent files when requested", async () => {
    const cwd = await makeWorkspace();

    await initKnowledgeProject({ cwd, agentFiles: true });

    await expect(pathExists(join(cwd, "CLAUDE.md"))).resolves.toBe(true);
    await expect(
      pathExists(join(cwd, ".github", "copilot-instructions.md")),
    ).resolves.toBe(true);
    await expect(
      pathExists(join(cwd, ".cursor", "rules", "know.mdc")),
    ).resolves.toBe(true);

    const cursor = await readFile(
      join(cwd, ".cursor", "rules", "know.mdc"),
      "utf8",
    );
    expect(
      cursor.startsWith(
        "---\ndescription: Use know before non-trivial repository edits\nalwaysApply: true\n---",
      ),
    ).toBe(true);
    expect(cursor).toContain(KNOW_MANAGED_BLOCK_START);
  });
});

describe("know init", () => {
  test("initializes the current working directory", async () => {
    const cwd = await makeWorkspace();
    const stdout: string[] = [];

    await expect(
      runCli(["init"], {
        cwd,
        stdout: (line) => stdout.push(line),
        stderr: () => undefined,
      }),
    ).resolves.toBe(0);

    await expectDirectory(join(cwd, ".knowledge", "concepts"));
    await expect(pathExists(join(cwd, "AGENTS.md"))).resolves.toBe(true);
    expect(stdout.join("\n")).toContain(join(cwd, ".knowledge"));
  });

  test("initializes a requested output directory", async () => {
    const cwd = await makeWorkspace();

    await expect(
      runCli(["init", "--out-dir", "generated"], {
        cwd,
        stdout: () => undefined,
        stderr: () => undefined,
      }),
    ).resolves.toBe(0);

    await expectDirectory(join(cwd, "generated", ".knowledge", "concepts"));
    await expect(pathExists(join(cwd, "generated", "AGENTS.md"))).resolves.toBe(
      true,
    );
  });

  test("supports dry-run without writing files", async () => {
    const cwd = await makeWorkspace();
    const stdout: string[] = [];

    await expect(
      runCli(["init", "--dry-run"], {
        cwd,
        stdout: (line) => stdout.push(line),
        stderr: () => undefined,
      }),
    ).resolves.toBe(0);

    expect(stdout.join("\n")).toContain("Would create:");
    expect(stdout.join("\n")).toContain(".knowledge/agent-instructions.md");
    expect(stdout.join("\n")).toContain("AGENTS.md");
    expect(stdout.join("\n")).toContain(
      "No user-authored content would be overwritten.",
    );
    await expect(pathExists(join(cwd, ".knowledge"))).resolves.toBe(false);
    await expect(pathExists(join(cwd, "AGENTS.md"))).resolves.toBe(false);
  });

  test("creates optional agent files with --agent-files", async () => {
    const cwd = await makeWorkspace();

    await expect(
      runCli(["init", "--agent-files"], {
        cwd,
        stdout: () => undefined,
        stderr: () => undefined,
      }),
    ).resolves.toBe(0);

    await expect(pathExists(join(cwd, "CLAUDE.md"))).resolves.toBe(true);
    await expect(
      pathExists(join(cwd, ".github", "copilot-instructions.md")),
    ).resolves.toBe(true);
    await expect(
      pathExists(join(cwd, ".cursor", "rules", "know.mdc")),
    ).resolves.toBe(true);
  });

  test("rejects conflicting agent-file options", async () => {
    const cwd = await makeWorkspace();
    const stderr: string[] = [];

    await expect(
      runCli(["init", "--agent-files", "--no-agent-files"], {
        cwd,
        stdout: () => undefined,
        stderr: (line) => stderr.push(line),
      }),
    ).resolves.toBe(1);

    expect(stderr.join("\n")).toContain(
      "Cannot combine --agent-files and --no-agent-files.",
    );
  });
});
