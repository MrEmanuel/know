import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  installLocalKnow,
  prepareFixtureRepo,
} from "./prepare-fixture-repo.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const repoDir = join(projectRoot, "tests", "fixtures", "init-repo");

await prepareFixtureRepo({
  repoDir,
  resetKnowledge: "all",
  gitignoreLines: [
    "node_modules/",
    ".git/",
    "package-lock.json",
    ".knowledge/",
    "AGENTS.md",
    "CLAUDE.md",
    ".github/",
    ".cursor/",
  ],
  packageJson: {
    name: "init-repo",
    private: true,
    type: "module",
    description:
      "Minimal fixture repo for exercising know init and blank-repo lifecycle commands.",
    scripts: {
      know: "know",
      "know:init": "know init",
      "know:init:dry-run": "know init --dry-run",
      "know:index": "know index",
      "know:status": "know status",
    },
  },
  readmeLines: [
    "# init-repo",
    "",
    "Minimal fixture repository prepared by `yarn dev:prepare:init-repo`.",
    "",
    "Useful commands:",
    "",
    "- `npm run know:init:dry-run`",
    "- `npm run know:init`",
    "- `npm run know:index`",
    "- `npm run know:status`",
    "",
    "This fixture starts without a `.knowledge/` tree so blank-repo init flows can be verified.",
    "",
    "The local `know` package is installed from the parent repo.",
  ],
});

await installLocalKnow(repoDir, projectRoot);

console.log(`Prepared ${repoDir}`);
