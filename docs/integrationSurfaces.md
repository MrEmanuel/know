# Integration surfaces

Know is pull-based. `know context <target>` returns the rules that apply to a given file, symbol, or glob. Integration surfaces determine when and how that query happens, turning on-demand context into pre-change awareness.

This document describes the contracts between Know and the systems that surface rules to users and agents.

## How Know surfaces rules

Know provides two commands that integration surfaces consume:

1. **`know context`**: Returns rules, rationale, verification status, and freshness for a given code target. Supports `--format json` for structured output and `--count` for cheap probing.
2. **`know check`**: Validates rule-link-code health from source files without trusting generated cache. Returns actionable diagnostics and meaningful exit codes for CI.

Every integration surface ultimately calls one or both commands. The difference between surfaces is when the call happens and how results are presented.

## Context surfaces

These surfaces deliver Know rules to people and agents editing code.

### IDE plugin

The IDE plugin is the recommended way for developers to get pre-change awareness. It works like Git source control integration in VS Code: Git's plugin continuously checks status and surfaces changes in source control, with a badge when changes exist. Know's IDE plugin does the same for rule-code relationships.

The plugin should:

- Run `know context` for active and open files and display matching rules in a dedicated panel.
- Show a notification indicator (like the Git source control badge) when rules connected to workspace files need re-verification.
- Provide a browsable list of all rules connected to currently active files.
- Surface unverified and broken rule-code relationships clearly.
- Refresh rule state on file save and file open.
- Link to TUI or CLI flows for editing and verification.

The IDE plugin is a maintained part of Know. VS Code is the primary target. The module contract is documented in `docs/systemModules/idePlugin.md`.

### Agent instructions (AGENTS.md)

Know should provide a documented agent integration contract: a clear, stable description of how AI agents interact with Know when editing code in a repository. `know init` should generate a `.know/AGENTS.md` snippet that agents can discover and read.

The agent contract should include:

- **When to query**: Before editing any file, call `know context <file> --format json`. For bulk operations, call `know context '<glob>' --format json`.
- **Cheap probing**: Use `know context <file> --count` to check whether rules exist before requesting full output.
- **Output shape**: Keep `--format json` schema stable and documented for reliable parsing.
- **Freshness**: Handle stale read model warnings gracefully. For short-lived tasks, run `know index` before querying. For long-running sessions, prefer `know watch`.
- **Verification gate**: Whether agents may call `know verify` is a team configuration and should be explicit.
- **Error handling**: If `know context` fails (missing read model, incompatible version), report the issue and suggest `know index` instead of proceeding without rule context.

The contract should be concise enough that an agent can consume it in one context window and act on it immediately.

### Agent hooks

Agent hooks are a high-leverage integration surface for AI agents. A hook that runs on file read or before file edit can call `know context` and inject relevant rules directly into agent context, without relying on the agent to remember to query.

This is similar to pre-commit hooks intercepting `git commit`: agent hooks intercept file operations and augment them with rule context. The exact hook mechanism depends on the agent framework, but Know's contract is the same: call `know context <target> --format json` and include the output in working context.

Agent hooks should:

- Call `know context` for the file or symbol about to be read or edited.
- Inject returned rules into the agent context for that operation.
- Stay quiet when no rules apply.
- Handle stale or missing read model errors gracefully.

### Agent plugins

Some agent frameworks support plugins or tool-use integrations. A Know agent plugin can expose `know context`, `know check`, `know search`, and `know status` as tools callable from the agent workflow.

This is a structured counterpart to hooks: instead of injecting context on every operation, the agent can intentionally query Know when needed.

## Rule health surfaces

These surfaces help teams maintain rule-code relationship health over time.

### Git hooks

Git hooks call Know at commit or push time to surface rule health issues.

- **Pre-commit**: Run `know check` to warn or block on unverified or broken relationships.
- **Pre-push**: Run `know check` with stricter policies for shared branches.
- **Post-checkout / post-merge**: Run `know index` to refresh read model after branch changes.

Git hooks are not part of Know itself. Know provides commands and exit codes that hooks consume.

### CI/CD pipeline integration

`know check` is designed for CI. It recomputes rule-link-code health from source files without trusting generated cache, and exits nonzero when selected failure policy is violated.

Useful patterns:

- Run `know check` as a required status check on pull requests.
- Generate `know report --format markdown` as a PR comment or CI artifact.
- Fail build on broken links; optionally warn on unverified relationships.

### Dependabot-style GitHub bot

A GitHub bot can monitor rule-code health and act on changes, similar to Dependabot for dependencies. This is a future integration surface.

Possible behaviors:

- Comment on pull requests with rules affected by changed files.
- Open issues or PRs when rules stay unverified beyond a threshold.
- Provide repository-level dashboards of rule health.

The bot contract is `know check --format json` and `know context --format json`.

## Configuration surfaces

These surfaces are how users create, edit, and manage rules and links.

### CLI

Primary authoring interface. `know` commands handle rule creation, link authoring, verification, indexing, and operations for interactive and automated workflows.

### TUI

Interactive terminal interface (`know browse`). Provides browsable and editable views of rules, concepts, and links with code previews.

### Manual TOML editing

Rules, concepts, and links are plain TOML files under `.know/`. Users and agents can edit them directly. Schema is strict, so unknown fields fail validation and `know check` catches mistakes after edits.
