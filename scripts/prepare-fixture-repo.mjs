import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function prepareFixtureRepo({
  repoDir,
  packageJson,
  readmeLines,
  gitignoreLines,
  resetKnowledge,
}) {
  await mkdir(repoDir, { recursive: true });

  await rm(join(repoDir, ".git"), { recursive: true, force: true });
  await rm(join(repoDir, "node_modules"), { recursive: true, force: true });
  await rm(join(repoDir, "package-lock.json"), { force: true });
  await rm(join(repoDir, "AGENTS.md"), { force: true });
  await rm(join(repoDir, "CLAUDE.md"), { force: true });
  await rm(join(repoDir, ".github"), { recursive: true, force: true });
  await rm(join(repoDir, ".cursor"), { recursive: true, force: true });

  if (resetKnowledge === "all") {
    await rm(join(repoDir, ".knowledge"), { recursive: true, force: true });
  } else {
    await rm(join(repoDir, ".knowledge", "indexes"), {
      recursive: true,
      force: true,
    });
    await rm(join(repoDir, ".knowledge", "agent-instructions.md"), {
      force: true,
    });
  }

  // Removed git init to avoid creating git repos in fixtures

  await writeFile(
    join(repoDir, ".gitignore"),
    gitignoreLines.join("\n") + "\n",
  );
  await writeFile(
    join(repoDir, "package.json"),
    JSON.stringify(packageJson, null, 2) + "\n",
  );
  await writeFile(join(repoDir, "README.md"), readmeLines.join("\n") + "\n");
}

export async function installLocalKnow(repoDir, projectRoot) {
  const rootPackageJson = JSON.parse(
    await readFile(join(projectRoot, "package.json"), "utf8"),
  );
  const runtimeDeps = Object.entries(rootPackageJson.dependencies ?? {}).map(
    ([name, version]) => `${name}@${version}`,
  );
  const packDir = join(repoDir, ".fixture-pack");

  await rm(packDir, { recursive: true, force: true });
  await mkdir(packDir, { recursive: true });

  const packResult = JSON.parse(
    exec(
      "npm",
      ["pack", "--json", "--pack-destination", packDir],
      projectRoot,
      {
        captureOutput: true,
      },
    ),
  );
  const tarballPath = join(packDir, packResult[0].filename);

  exec("npm", ["install", tarballPath, ...runtimeDeps], repoDir);
  await rm(packDir, { recursive: true, force: true });
}

function exec(command, args, cwd, options = {}) {
  const result = execFileSync(command, args, {
    cwd,
    stdio: options.captureOutput ? "pipe" : "inherit",
    encoding: options.captureOutput ? "utf8" : undefined,
  });

  return typeof result === "string" ? result : "";
}
