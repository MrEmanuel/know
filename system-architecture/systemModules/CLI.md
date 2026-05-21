# Know CLI

When attached to an interactive terminal, the `know` command without any arguments starts an interactive command selection flow.

When stdin is not interactive, bare `know` must not prompt or block. It should print concise help or an actionable error instead.

The command interface does not own domain logic. It delegates to the underlying system modules.

## Read model contract

Know's normal read commands use the generated SQLite read model as their
operational read surface. They do not use reparsed knowledge files as
their normal answer path.

This includes target context, rule listing, rule inspection, status summaries,
reports, browsing, semantic search, and stable SQL querying. If the read model
is missing or incompatible, these commands should fail with actionable guidance
to run `know index`. If the read model is stale, commands should report the
freshness problem and then follow their command-specific freshness policy.

`know check` is the main exception. It recomputes from the current knowledge files,
approval file, and repository code in read-only mode so CI and audits can prove
source health without trusting the generated cache.

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

Commands that write knowledge files or verification data should support `--dry-run` where practical, printing the planned change without writing it.

## Guided next actions

Know should help users move through the rule lifecycle without requiring them
to memorize the command graph.

After successful commands, the CLI may recommend the next useful commands for
the affected rule, link, or target. For example, after creating and linking a
rule, Know can suggest `know index`, `know context <target>`,
`know verify --rule <rule-id>`, `know check`, or `know watch`.

When stdin is an interactive terminal, Know may offer these as a short
selection flow. When stdin is not interactive, or when `--no-input` is passed,
Know must not prompt or block; it should print recommended commands in normal
text output, and include structured next-action data in JSON output where that
command supports `--format json`.

For interactive sessions in a repository, Know should recommend `know watch` as
the lowest-friction way to keep generated state fresh while the user or agent is
editing. For short-lived automation and one-shot agent tasks, recommended next
actions should prefer explicit command chains, such as `know index` followed by
`know context <target>`.

## Self-documenting CLI

The CLI should be self-documenting. A user or agent should be able to query the installed `know` binary to understand its command structure, available flags, accepted values, and intended usage without reading the source code or these design documents first.

The exact implementation is not decided yet. The direction is similar in spirit to tools such as Google's `gwc`, where the CLI can expose structured information about itself for humans, scripts, shell completion, and AI agents.

At minimum, the CLI should make the following discoverable:

- available commands and subcommands
- command purpose and usage examples
- flags, argument names, defaults, and accepted values
- output formats supported by each command
- whether a command reads, writes, or runs in read-only mode
- whether a command may prompt interactively
- which commands are intended for humans, automation, or both

This self-documenting surface should describe the CLI contract, not internal implementation details. It should stay aligned with normal help output and shell completion so Know has one coherent command model.

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

Path and glob completion should use deterministic repository-root filesystem discovery. Completion respects repository ignore rules, such as `.gitignore`, by default. Tree-sitter may improve symbol completion and code-aware suggestions, but it does not define the identity of path or glob targets.

Completion should remain an aid, not a requirement. All commands must work without shell completion.

CLI commands may accept local OS-style path input from users, but knowledge files and generated verification entries must use normalized repository-root-relative paths with `/` separators.

CLI commands may also accept bare symbol input, such as `Invoice.calculateTotal`, when it resolves unambiguously. When writing knowledge files or generated verification entries, Know must store symbol targets in canonical file-scoped `path#symbol` form.

Know has the following commands:

### know context

Know's main feature.
Return the rules and rationale that apply before editing a given symbol, glob,
or path. The command takes the input, queries the generated read model for
resolved links, and returns the relevant rules.

`know context` accepts one target and returns the rules that apply to that
target, including each matching relationship's verification status and
freshness. Unverified relationships are included; they are surfaced as context,
not filtered out.

Only one target is accepted per command invocation. Globs provide the first-class way to ask about multiple files.

Know should infer the target kind when it is unambiguous:

- Existing repository path - path target
- Target containing glob syntax - glob target
- Target in canonical `path#symbol` form - symbol target
- Otherwise, a Tree-sitter-resolvable code symbol - symbol target

If a target is ambiguous, the command should fail with an actionable message in non-interactive mode. In an interactive terminal, it may ask the user to choose the intended target kind.

Explicit target-kind flags should be available as escape hatches for automation and ambiguous cases.

`know context` is a read command. It may inspect enough current state to detect
stale generated views, but it must not write knowledge files,
`.know/linkVerification.toml`, `.know/linkVerification.lock.toml`, or generated
cache files as a side effect.

If the read model is missing, `know context` should fail with an actionable
message telling the user to run `know index`.

If the read model exists but appears stale, `know context` should warn and use
the existing read model by default.

If the read model exists but is incompatible with the current Know version or
read-model contract, `know context` should fail with an actionable message
telling the user to run `know index`.

Freshness is based on the metadata and hashes written with the active read
model, including `resolved_model_hash` and the hash of
`.know/linkVerification.lock.toml`. Commands that require fresh output must
prove the active read model still corresponds to the current knowledge files,
approval file, lockfile, resolver inputs, and repository targets before
answering. Otherwise the generated cache is stale.

Freshness options:

- require-fresh - fail instead of answering if the read model is stale

Useful forms include:

```txt
know context src/billing/invoice.ts
know context 'src/billing/**/*.ts'
know context 'src/billing/**/*.ts' --exclude 'src/billing/generated/**'
know context 'src/billing/invoice.ts#Invoice.calculateTotal'
know context Invoice.calculateTotal
know context --kind symbol Invoice.calculateTotal
know context --count src/billing/invoice.ts
know context --format json src/billing/invoice.ts
know context --require-fresh src/billing/invoice.ts
know index && know context src/billing/invoice.ts
```

Useful options include:

- kind - path, glob, or symbol
- exclude - exclude pattern for glob targets. May be repeated.
- format - text or json
- count - print only the number of matching rules
- require-fresh

`--count` returns the number of rules that would be included in normal context output for the same target and filters. It is intended for agents and scripts that need to estimate how much rule context exists for a path, glob, or symbol before requesting the full output.

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

`know status` is the fastest way to understand whether the system is healthy. It summarizes the number of rules, concepts, inline links, unlinked rules, verified relationships, unverified relationships, broken links, invalid definitions, lockfile freshness, and index freshness.

`know status` also reports unlinked rules. Unlinked rules are valid rules with no inline links. They are visible in project health output because they will not appear in target-based `know context`.

The default output is human-readable. For automation, `know status` should support structured output through `--format json`.

`know status` is informational. It should exit successfully when the current state can be inspected, even if the state includes unverified or broken relationships. Failure exit codes are reserved for cases where Know cannot inspect the system, such as invalid command usage, unreadable files, or internal errors. CI should use `know check`.

### know report

Produce a detailed report of the current Know system state.

`know report` is the fuller and more configurable version of `know status`. It summarizes rules, concepts, links, verification state, unlinked rules, broken targets, unverified relationships, stale lockfiles, tags, and coverage by file or target. It can be used for audits, CI artifacts, pull request comments, and stakeholder-facing rule health summaries.

Useful options include:

- format - text, markdown, or json
- output - write the report to a file path instead of stdout
- include - all, verified, unverified, broken, unlinked, stale-lockfile, rules, concepts, links, tags, coverage
- group-by - rule, concept, tag, file, target, or status

Useful forms include:

```txt
know report --format markdown --output know-report.md
know report --format json --output know-report.json
```

### know init

Initialize the .know directory with its sub-folders, and example definition files. The rules example includes inline links.

`know init` also creates `.know/.gitignore` that ignores `cache/`, and creates `.know/cache/` as the location for disposable generated local data.

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
- link_verification_status
- unlinked_rules
- read_model_metadata

The `link_verification_status` and `unlinked_rules` views expose the status records mirrored from `.know/linkVerification.lock.toml`. This lets `know query`, agents, reports, and TUI flows join current verification state with rules, concepts, resolved targets, and search results without reparsing TOML files.

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

`know check` validates the knowledge files, resolves inline links, derives verification status, and reports actionable issues. It must not write knowledge files, `.know/linkVerification.toml`, `.know/linkVerification.lock.toml`, or generated indexes.

`know check` recomputes from the current knowledge files, `.know/linkVerification.toml`, and current repository code. It does not trust an existing generated read model or `.know/linkVerification.lock.toml` for pass/fail decisions. It compares the recomputed expected lockfile with the committed lockfile and reports `stale-lockfile` when they differ.

By default, `know check` prints a concise report with counts and actionable issues. A clean check should make it obvious that all rule-link-code relationships are verified and `.know/linkVerification.lock.toml` is fresh.

`know check` is the CI-oriented command. It exits nonzero when the inspected system violates the selected failure policy.

Useful options include:

- format - text or json
- fail-on - invalid, unverified, broken, unlinked, stale-lockfile, stale-index, or source-issue
- include - all, invalid, unverified, broken, unlinked, stale-lockfile, stale-index

`source-issue` means any current source-state problem: invalid definitions, broken links, unverified relationships, or unlinked rules. It does not include `stale-lockfile` or `stale-index`, because `know check` recomputes from source and does not depend on generated artifacts for correctness. Workflows that require the committed reflection or generated cache to be fresh should explicitly use `--fail-on stale-lockfile` or `--fail-on stale-index`.

`stale-lockfile` means `.know/linkVerification.lock.toml` is missing, invalid, or differs from the deterministic lockfile Know would generate from the current knowledge files, `.know/linkVerification.toml`, current repository code, and resolver settings.

`stale-index` means the generated cache is missing, stale, incompatible with the current read-model contract, built against a different normalized lockfile hash, or paired with a semantic-search sidecar whose `resolved_model_hash` does not match SQLite.

### know verify

Approve or re-approve rule-link-code relationships.

`know verify` is state-changing. It records the current rule, link, and target fingerprints in `.know/linkVerification.toml` for relationships the user has reviewed and approved.

After updating `.know/linkVerification.toml`, `know verify` recomputes and writes `.know/linkVerification.lock.toml` so the committed reflection shows the newly approved status.

`know verify` should explain what relationships will be verified before writing, and it should support `--dry-run`.

Useful options include:

- rule - verify relationships for one rule
- target - verify relationships for one target
- kind - path, glob, or symbol
- all - verify all currently resolvable relationships
- status - unverified
- dry-run - print the planned verification changes without writing

### know index

Validate and parse the .know file structure, then update the committed link-verification lockfile, generated read model, and semantic search index.

`know index` performs an atomic full rebuild. It recomputes the current resolved model from knowledge files, `.know/linkVerification.toml`, and current repository code. It writes `.know/linkVerification.lock.toml` and generated cache data to temporary locations and only replaces `.know/linkVerification.lock.toml`, `.know/cache/know.sqlite`, and `.know/cache/semantic/` after validation, parsing, link resolution, lockfile generation, read-model generation, and semantic-index generation all succeed.

If indexing fails, the existing lockfile and cache remain unchanged and the command reports actionable diagnostics.

`know index` is the generated-artifact refresh command. It exists so the committed link-verification reflection is current and read-model-dependent commands such as `know context`, `know search`, and `know browse` can answer quickly from generated local data.

Each successful index run stores `source_model_hash`, `link_verification_hash`, `link_verification_lock_hash`, and `resolved_model_hash` in SQLite. The resolved model records the parser output, approval data, resolver inputs, resolved target sets, target fingerprints, derived link-verification statuses, schema versions, Tree-sitter resolver inputs, and semantic-search configuration used to build the lockfile and cache.

### know watch

Automatically refresh generated Know data when likely inputs change.

`know watch` is the canonical long-running command for keeping
`.know/linkVerification.lock.toml`, the generated read model, and semantic
search index fresh during local development.

`know watch` is the recommended mode for interactive work in a repository,
whether the actor is a human or a long-running agent. Short-lived agents and CI
jobs should usually use explicit `know index` calls instead of starting a
watcher.

`know watch` watches `.know` files, resolver inputs, and linked repository
targets where practical. Filesystem events are rebuild triggers only. Freshness
is still determined by resolved model hash recomputation and lockfile
comparison.

`know sync` is not a canonical command unless a separate synchronization workflow is defined later.

### know rule

Create, edit, inspect, and maintain rules. The CLI authoring surface is centered on rules because rules own inline links and concept references.

The TUI provides the richer guided editor. Manual TOML editing remains a first-class path for users and agents that prefer direct file edits. `know rule` commands cover common direct actions, scripting, and CI-friendly workflows.

`know rule` commands may prompt interactively for missing fields, but every authoring action must also be possible with explicit flags and `--no-input`.

Read-only `know rule` commands query the generated read model. `know rule show`
should make a rule's inline links, resolved code targets, and verification
status available so users and agents can list the code locations a rule points
to without manually reading TOML.

`know rule list` is a structured read, not a TOML dump. It should be able to
filter and group by fields such as tags, concepts, link counts, verification
status, and resolved targets by querying the read model.

Useful subcommands include:

- add
- edit
- list
- show
- link add
- link remove
- concept add
- concept remove

`know rule link add` should be target-first. In interactive mode, the command
should ask what code the rule applies to, accept fuzzy input such as a function
name, class name, file name, or directory prefix, and present ranked candidates.
Tree-sitter-backed symbol candidates should be shown first when available.
Paths and globs remain available, but the prompt should steer users toward them
only when the rule genuinely applies to a file or area rather than a named
symbol.

In non-interactive mode, explicit target and kind flags remain available for
scripts and agents. When the target can be resolved unambiguously, Know may
infer the kind and store the canonical inline link.

`know rule list` should support target-aware filtering for agent workflows that need to inspect or count relevant rules without loading full context output.

Useful forms include:

```txt
know rule list --target src/billing/invoice.ts --count
know rule list --target 'src/billing/**/*.ts' --count
know rule list --target 'src/billing/invoice.ts#Invoice.calculateTotal' --count
know rule list --target Invoice.calculateTotal --kind symbol --count
```

Useful options include:

- target - path, glob, or symbol to filter rules by
- kind - path, glob, or symbol
- exclude - exclude pattern for glob targets. May be repeated.
- count - print only the number of matching rules

Target-specific rule counts should use the same target resolution and rule-selection behavior as `know context --count`.

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
