# Know CLI

When attached to an interactive terminal, the `know` command without any arguments starts an interactive command selection flow.

When stdin is not interactive, bare `know` must not prompt or block. It should print concise help or an actionable error instead.

The command interface does not own domain logic. It delegates to the underlying system modules.

## Design basis

Know follows the [Command Line Interface Guidelines](https://clig.dev/) as the baseline for CLI design decisions.

Important implications for Know:

- Commands should be human-first by default and automation-friendly by option.
- Primary command output goes to stdout; diagnostics, progress, and errors go to stderr.
- Commands should use meaningful exit codes so CI and scripts can depend on them.
- Help output should be concise, discoverable, and example-driven.
- Destructive or state-changing commands should explain what they will do and support `--dry-run` where practical.
- Interactive flows must not prevent non-interactive use.
- Output format flags should be consistent across commands. Commands that support structured output should use `--format` with values such as `text`, `json`, and, where useful, `markdown`.

## Interaction model

Know is designed for both humans and automation.

Authoring commands may prompt for missing inputs when stdin is an interactive terminal. The same workflows must also be available through explicit arguments and flags so they can be used by scripts, CI, and AI agents.

Authoring commands must not require prompts. When stdin is not interactive, or when `--no-input` is passed, commands fail with an actionable error if required input is missing.

Commands that write source files or verification data should support `--dry-run` where practical, printing the planned change without writing it.

## Completion model

Know should support shell completion for commands, subcommands, flags, and known flag values.

Completions should include both static CLI structure and dynamic project-aware values where practical:

- command and subcommand names
- flag names
- enum flag values, such as output formats and link kinds
- rule IDs
- concept IDs
- tags
- repository paths
- known glob-friendly path prefixes
- Tree-sitter-backed symbols when a supported grammar is available

Path and glob completion should use deterministic repository-root filesystem discovery. Tree-sitter may improve symbol completion and code-aware suggestions, but it does not define the identity of path or glob targets.

Completion should remain an aid, not a requirement. All commands must work without shell completion.

Know has the following commands:

### know context

The Know systems main feature.
Return relevant rule, concept and rationale data for a given symbol, glob, or path. Takes the input, queries the generated read model for resolved links, and returns relevant rules.

`know context` accepts one target and returns the rules that apply to that target.

Only one target is accepted per command invocation. Globs provide the first-class way to ask about multiple files.

Know should infer the target kind when it is unambiguous:

- Existing repository path - path target
- Target containing glob syntax - glob target
- Otherwise, a Tree-sitter-resolvable code symbol - symbol target

If a target is ambiguous, the command should fail with an actionable message in non-interactive mode. In an interactive terminal, it may ask the user to choose the intended target kind.

Explicit target-kind flags should be available as escape hatches for automation and ambiguous cases.

`know context` reads from the generated read model. It does not rebuild or refresh the read model itself.

If the read model is missing, `know context` should fail with an actionable message telling the user to run `know index`.

If the read model exists but appears stale, `know context` should warn and use the existing read model by default.

Freshness options:

- require-fresh - fail instead of answering if the read model is stale

Useful forms include:

```txt
know context src/billing/invoice.ts
know context 'src/billing/**/*.ts'
know context 'src/billing/**/*.ts' --exclude 'src/billing/generated/**'
know context Invoice.calculateTotal
know context --kind symbol Invoice.calculateTotal
know context --format json src/billing/invoice.ts
know context --require-fresh src/billing/invoice.ts
know index && know context src/billing/invoice.ts
```

Useful options include:

- kind - path, glob, or symbol
- exclude - exclude pattern for glob targets. May be repeated.
- format - text or json
- require-fresh

### know browse

Opens the TUI, an interactive terminal user interface to browse and edit rules, concepts, and inline rule links.

`know browse` is the canonical command for the terminal user interface.

### know help

List all commands

### know inspect

Inspect the local Know runtime and environment.

`know inspect` shows tool and runtime metadata, such as the Know version, repository root, `.know` root, generated read model path, semantic index path, supported Tree-sitter grammars, enabled features, and relevant configuration paths.

`know inspect` is about the local Know installation and runtime environment. For project knowledge state, use `know status`, `know check`, or `know report`.

### know status

Print a concise overview of the current Know system state.

`know status` is the fastest way to understand whether the system is healthy. It summarizes the number of rules, concepts, inline links, verified relationships, unverified relationships, broken links, invalid definitions, and index freshness.

The default output is human-readable. For automation, `know status` should support structured output through `--format json`.

`know status` is informational. It should exit successfully when the current state can be inspected, even if the state includes unverified or broken relationships. Failure exit codes are reserved for cases where Know cannot inspect the system, such as invalid command usage, unreadable files, or internal errors. CI should use `know check`.

### know report

Produce a detailed report of the current Know system state.

`know report` is the fuller and more configurable version of `know status`. It summarizes rules, concepts, links, verification state, broken targets, unverified relationships, tags, and coverage by file or target. It can be used for audits, CI artifacts, pull request comments, and project documentation.

Useful options include:

- format - text, markdown, or json
- output - print to stdout or write to a file
- include - all, verified, unverified, broken, rules, concepts, links, tags, coverage
- group-by - rule, concept, tag, file, target, or status
- fail-on - unverified, broken, or any issue

### know init

Initialize the .know directory with its sub-folders, and example definition files. The rules example includes inline links.

#### flags

- overwrite - Overwrites any existing data in .know directory
- dry-run - does a dry run, printing to console instead

### know query

Execute a read-only SQL query against documented stable views in the generated read model.

`know query` is an advanced command for AI agents, diagnostics, and power users. It is useful when structured SQL is a better interface than `know context`, `know search`, `know status`, or `know report`.

`know query` must be read-only. It must reject writes and schema changes.

The query contract is documented stable views, not arbitrary internal SQLite tables. Internal tables may change as implementation details. Stable views should be treated as the compatibility surface for agents and scripts.

Initial stable views should include:

- rules
- concepts
- links
- rule_context
- verification_status

Useful forms include:

```txt
know query "select * from rules where id = 'customer-email-immutable'" --format json
know query --file query.sql --format json
know query --stdin --format json
```

Normal users should prefer `know context`, `know search`, `know status`, and `know report`.

### know search

Semantic search for any rules, concepts, or (clickable) links. Returns an interactive list where user can browse relevant information, select multiple, and print selected option data to console or file.

`know search` is user-facing and relevance-ranked. It accepts natural language or keyword input and searches across rules, concepts, and inline links.

### know check

Run a read-only health check for the Know system.

`know check` validates the `.know` source files, resolves inline links, derives verification status, and reports actionable issues. It must not write source files, generated indexes, or `.know/verification.toml`.

By default, `know check` prints a concise report with counts and actionable issues. A clean check should make it obvious that all rule-link-code relationships are verified.

`know check` is the CI-oriented command. It exits nonzero when the inspected system violates the selected failure policy.

Useful options include:

- format - text or json
- fail-on - invalid, unverified, broken, stale-index, or any issue
- include - all, invalid, unverified, broken, stale-index

### know verify

Approve or re-approve rule-link-code relationships.

`know verify` is state-changing. It records the current rule, link, and target fingerprints in `.know/verification.toml` for relationships the user has reviewed and approved.

`know verify` should explain what relationships will be verified before writing, and it should support `--dry-run`.

Useful options include:

- rule - verify relationships for one rule
- target - verify relationships for one target
- kind - path, glob, or symbol
- all - verify all currently resolvable relationships
- status - unverified
- dry-run - print the planned verification changes without writing

### know index

Validate and parse the .know file structure, then update the generated read model and semantic search index.

### know watch

Automatically index .know files when they change.

`know watch` is the canonical long-running command for keeping the generated read model and semantic search index fresh during local development.

`know sync` is not a canonical command unless a separate synchronization workflow is defined later.

### know rule

Create, edit, inspect, and maintain rules. The CLI authoring surface is centered on rules because rules own inline links and concept references.

The TUI provides the richer guided editor. Manual TOML editing remains a first-class path for users and agents that prefer direct file edits. `know rule` commands cover common direct actions, scripting, and CI-friendly workflows.

`know rule` commands may prompt interactively for missing fields, but every authoring action must also be possible with explicit flags and `--no-input`.

Useful subcommands include:

- add
- edit
- list
- show
- link add
- link remove
- concept add
- concept remove

### know concept

Create, edit, inspect, and list reusable concepts.

Useful subcommands include:

- add
- edit
- list
- show

### know link

Inspect and repair inline rule links across the system.

Links are authored under rules, so link creation and removal normally happen through `know rule link add` and `know rule link remove`. Top-level `know link` commands are for cross-rule inspection, diagnostics, and repair workflows.

Useful subcommands include:

- list
- show
- repair
