#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initKnowledgeProject,
  KnowledgeProjectAlreadyExistsError,
  type InitKnowledgeProjectResult,
} from "./init";
import { indexProject } from "./indexer";
import { getContext, renderContext } from "./context";
import { describeSchema, formatQueryResult, runQuery } from "./query";
import { syncProject } from "./sync";
import { getStatus, renderStatus } from "./status";
import { reviewRule } from "./review";
import { join } from "node:path";

export interface CliOptions {
  cwd?: string;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

export async function runCli(
  args: string[] = process.argv.slice(2),
  options: CliOptions = {},
) {
  const stdout = options.stdout ?? console.log;
  const stderr = options.stderr ?? console.error;
  const [command] = args;

  if (command === "init") {
    const initOptions = parseInitArgs(args.slice(1));

    if (!initOptions.ok) {
      stderr(initOptions.message);
      stderr("Run `know init --help` for usage.");
      return 1;
    }

    if (initOptions.help) {
      stdout(initHelp);
      return 0;
    }

    try {
      const result = await initKnowledgeProject({
        cwd: options.cwd,
        outDir: initOptions.outDir,
        agentFiles: initOptions.agentFiles,
        dryRun: initOptions.dryRun,
      });

      if (initOptions.dryRun) {
        for (const line of formatDryRun(result)) {
          stdout(line);
        }
        return 0;
      }

      stdout(`Initialized ${result.root}`);
      return 0;
    } catch (error) {
      if (error instanceof KnowledgeProjectAlreadyExistsError) {
        stderr(error.message);
        stderr("Remove the existing path or choose another --out-dir.");
        return 1;
      }

      throw error;
    }
  }

  if (command === "index") {
    try {
      const result = await indexProject({
        projectRoot: options.cwd ?? process.cwd(),
      });
      stdout(
        `Indexed ${result.fileCount} file(s), ${result.itemCount} item(s), ` +
          `${result.anchorCount} anchor(s) (${result.brokenAnchorCount} broken).`,
      );
      stdout(`Wrote ${result.dbPath}`);
      return 0;
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  if (command === "context") {
    const target = args[1];
    if (target === undefined || target === "--help" || target === "-h") {
      stdout(`Usage: know context <path>

Prints active rules, stale rules, their rationale, connected concepts,
and broken anchors touching <path>.`);
      return target === undefined ? 1 : 0;
    }

    const projectRoot = options.cwd ?? process.cwd();
    const dbPath = join(
      projectRoot,
      ".knowledge",
      "indexes",
      "knowledge.sqlite",
    );
    try {
      const ctx = getContext({ dbPath, projectRoot, targetPath: target });
      stdout(renderContext(ctx).trimEnd());
      return 0;
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      stderr("Run `know index` first to build the knowledge index.");
      return 1;
    }
  }

  if (command === "query") {
    const projectRoot = options.cwd ?? process.cwd();
    const dbPath = join(
      projectRoot,
      ".knowledge",
      "indexes",
      "knowledge.sqlite",
    );
    const rest = args.slice(1);

    if (rest[0] === "--help" || rest[0] === "-h") {
      stdout(`Usage: know query [--schema] <sql>

Runs a read-only SQL query against the knowledge index.
Use --schema to print all CREATE TABLE statements.`);
      return 0;
    }

    if (rest[0] === "--schema") {
      try {
        stdout(describeSchema(dbPath));
        return 0;
      } catch (error) {
        stderr(error instanceof Error ? error.message : String(error));
        stderr("Run `know index` first to build the knowledge index.");
        return 1;
      }
    }

    const sql = rest.join(" ").trim();
    if (sql.length === 0) {
      stderr("Missing SQL. Run `know query --help` for usage.");
      return 1;
    }

    try {
      const result = runQuery({ dbPath, sql });
      stdout(formatQueryResult(result));
      return 0;
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  if (command === "sync") {
    try {
      const result = await syncProject({
        projectRoot: options.cwd ?? process.cwd(),
      });
      if (result.changed) {
        stdout(
          `Synced ${result.fileCount} file(s), ${result.itemCount} item(s), ` +
            `${result.anchorCount} anchor(s) (${result.brokenAnchorCount} broken).`,
        );
      } else {
        stdout("No changes since last index.");
      }
      return 0;
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  if (command === "status") {
    const projectRoot = options.cwd ?? process.cwd();
    const dbPath = join(
      projectRoot,
      ".knowledge",
      "indexes",
      "knowledge.sqlite",
    );
    try {
      stdout(renderStatus(getStatus({ dbPath })));
      return 0;
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      stderr("Run `know index` first to build the knowledge index.");
      return 1;
    }
  }

  if (command === "review") {
    const ruleId = args[1];
    if (ruleId === undefined || ruleId === "--help" || ruleId === "-h") {
      stdout(`Usage: know review <rule-id>

Marks the rule as reviewed today (updates its reviewed: frontmatter)
and re-indexes the knowledge base.`);
      return ruleId === undefined ? 1 : 0;
    }

    try {
      const result = await reviewRule({
        projectRoot: options.cwd ?? process.cwd(),
        ruleId,
      });
      stdout(`Marked ${ruleId} reviewed ${result.reviewedAt}`);
      stdout(`Updated ${result.path}`);
      return 0;
    } catch (error) {
      stderr(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  if (command === undefined || command === "--help" || command === "-h") {
    stdout(`Usage: know <command>

Commands:
  init             Create or update the .knowledge project structure
  index            Build the SQLite knowledge index from .knowledge/
  sync             Re-index only when .knowledge/ files have changed
  status           Print counts of rules and concepts
  context <path>   Print rules and rule-linked context touching <path>
  query <sql>      Run a read-only SQL query against the index
  review <rule-id> Mark a rule as reviewed today and re-index`);
    return 0;
  }

  stderr(`Unknown command: ${command}`);
  stderr("Run `know --help` for usage.");
  return 1;
}

interface InitParseResult {
  ok: boolean;
  help?: boolean;
  outDir?: string;
  agentFiles?: boolean;
  dryRun?: boolean;
  message: string;
}

const initHelp = `Usage: know init [options]

Options:
  --out-dir <path>  Parent directory where .knowledge will be created
  --agent-files     Create missing agent-specific instruction files
  --no-agent-files  Do not update agent-specific instruction files
  --dry-run         Preview changes without writing files
  -h, --help        Show this help`;

function parseInitArgs(args: string[]): InitParseResult {
  let outDir: string | undefined;
  let agentFiles: boolean | undefined;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "-h" || arg === "--help") {
      return { ok: true, help: true, message: "" };
    }

    if (arg === "--out-dir") {
      const value = args[index + 1];

      if (value === undefined || value.startsWith("-")) {
        return { ok: false, message: "Missing value for --out-dir." };
      }

      outDir = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--out-dir=")) {
      const value = arg.slice("--out-dir=".length);

      if (value.length === 0) {
        return { ok: false, message: "Missing value for --out-dir." };
      }

      outDir = value;
      continue;
    }

    if (arg === "--agent-files") {
      if (agentFiles === false) {
        return {
          ok: false,
          message: "Cannot combine --agent-files and --no-agent-files.",
        };
      }

      agentFiles = true;
      continue;
    }

    if (arg === "--no-agent-files") {
      if (agentFiles === true) {
        return {
          ok: false,
          message: "Cannot combine --agent-files and --no-agent-files.",
        };
      }

      agentFiles = false;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    return { ok: false, message: `Unknown init option: ${arg}` };
  }

  return { ok: true, outDir, agentFiles, dryRun, message: "" };
}

function formatDryRun(result: InitKnowledgeProjectResult) {
  const create = result.agentInstructions.filter(
    (operation) => operation.action === "create",
  );
  const update = result.agentInstructions.filter(
    (operation) => operation.action === "update",
  );
  const unchanged = result.agentInstructions.filter(
    (operation) => operation.action === "unchanged",
  );
  const skip = result.agentInstructions.filter(
    (operation) => operation.action === "skip",
  );
  const lines: string[] = [];

  addGroup(lines, "Would create:", result, create);
  addGroup(lines, "Would update:", result, update);
  addGroup(lines, "Would leave unchanged:", result, unchanged);
  addGroup(lines, "Would skip:", result, skip);

  if (lines.length > 0) {
    lines.push("");
  }

  lines.push("No user-authored content would be overwritten.");

  return lines;
}

function addGroup(
  lines: string[],
  heading: string,
  result: InitKnowledgeProjectResult,
  operations: InitKnowledgeProjectResult["agentInstructions"],
) {
  if (operations.length === 0) {
    return;
  }

  if (lines.length > 0) {
    lines.push("");
  }

  lines.push(heading);

  for (const operation of operations) {
    const displayPath = relative(result.projectRoot, operation.path) || ".";
    const reason =
      operation.reason === undefined ? "" : ` (${operation.reason})`;
    lines.push(`  ${displayPath}${reason}`);
  }
}

if (isEntrypoint()) {
  runCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}

function isEntrypoint() {
  const entryPath = process.argv[1];

  if (entryPath === undefined) {
    return false;
  }

  try {
    return realpathSync(entryPath) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}
