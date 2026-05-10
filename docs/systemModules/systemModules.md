# Know system modules

This document describes Know's system modules and how they interact. It is intentionally implementation-agnostic; concrete library and runtime choices belong in `docs/techStack.md`.

For specific details on the CLI commands, tech stack, file structure, syntax, and primitives, please refer to the respective documents in the docs directory.

## System modules

### core

Shared core logic, data structures, and utilities used across the system.

### cli

The command-line interface is the main entry point for direct user and agent interaction. It starts the interactive interface, executes commands, and performs operations like indexing, searching, validating, and retrieving context.

### tui

The interactive terminal interface allows users to browse and edit rules, concepts, and inline rule links.

### config parser

Transforms schema-valid source files into the generated read model. This includes extracting rules, concepts, and inline rule links, then normalizing them into queryable records.

The parser also prepares data needed by the semantic search index. Concrete storage and semantic-search implementation choices belong in `docs/techStack.md`.

### indexer

Builds the committed link-verification lockfile, generated local read model, and semantic search index from source TOML files, `.know/linkVerification.toml`, and current repository targets.

The detailed indexer contract is documented in `docs/systemModules/indexer.md`.

The baseline indexer performs an atomic full rebuild. It runs the shared validation, parsing, analysis, lockfile generation, and projection pipeline from scratch, writes generated data to temporary locations, and only replaces `.know/linkVerification.lock.toml`, `.know/cache/know.sqlite`, and `.know/cache/semantic/` after the full rebuild succeeds.

If validation, parsing, link resolution, lockfile generation, read-model generation, or semantic-index generation fails, the existing lockfile and cache remain unchanged. Incremental indexing is a possible future optimization, not baseline behavior.

The validation, parsing, link-resolution, fingerprinting, and status-derivation steps are shared system logic. `know index` runs that pipeline in generation mode and writes the committed lockfile plus generated cache data. `know check` runs the same analysis in read-only mode and does not write the lockfile or cache files.

Index freshness means the active generated artifacts correspond to the current source files, approval file, resolver inputs, repository targets, and semantic-search settings. `know check` and `know index` prove this by recomputing the current resolved model, comparing its hash with the `resolved_model_hash` stored in the active SQLite read model, and checking that `.know/linkVerification.lock.toml` matches the recomputed expected lockfile. Normal read commands answer from the active read model and may inspect current files only to detect or enforce freshness. The resolved model covers parser output, `.know/linkVerification.toml`, resolver inputs, resolved target sets, target fingerprints, derived link-verification statuses, schema versions, Tree-sitter resolver inputs, and semantic-search configuration. File mtimes and watcher events may optimize freshness checks, but they are not the correctness boundary.

### config validator

Ensures that the configuration files provided by the user are correct, complete, and adhere to the expected schema before any parsing or processing occurs.

Know source files use a strict schema. Unknown fields are validation errors. Tags are the supported lightweight mechanism for classification, filtering, search, context, and project-specific grouping. Tags are free-form strings and are not normalized to the rule and concept ID slug format.

### link validator

1. User defines an inline link under a rule.
2. Link validator resolves the link target and checks that the referenced code exists.
3. It fingerprints the owning rule.
4. It fingerprints the inline link definition.
5. It fingerprints the resolved code target or targets.
6. User verifies the rule-link-code relationship.
7. The result is saved to `.know/linkVerification.toml`, reflected into `.know/linkVerification.lock.toml`, and then re-indexed into the generated read model.
8. Later, if the rule, link, or target fingerprint changes, that rule-link-code relationship becomes unverified.

A link can be either:

Verified | Unverified | Broken

Verified if the rule-link-code relationship has been reviewed and the current rule, link, and target fingerprints match the stored verification entry.
Unverified if the code, rule, or link definition has changed since the last verification, or if the relationship has never been verified. Know reports the reason, but both cases use the same `unverified` status.
Broken if the code target no longer resolves, or if the link itself is not properly defined.

Verification status belongs to each rule-link-code relationship. If two rules point to the same code target, each relationship is verified independently.

Inline links do not have source-defined IDs. The read model may assign internal row IDs, but source files identify links by their owning rule and target metadata.

Rules may have zero inline links. A rule without links has the rule-level coverage state `unlinked`. This is not a link verification status, because no rule-link-code relationship exists yet. Unlinked rules are valid, searchable, and reportable, but they are not returned by target-based `know context` until linked.

Path and glob links are resolved through deterministic filesystem matching from the repository root. Source targets and generated verification entries use normalized repository-root-relative paths with `/` separators. Absolute paths, `..` segments, leading `./`, and backslashes are invalid in source link definitions.

A path link must resolve to exactly one repository file. A directory is not a valid path target; users should use a glob link for directory or subtree coverage.

Glob links resolve to repository files only. Directories are not included in the resolved target set. A glob link whose syntax is invalid is an invalid link definition. A syntactically valid glob that resolves to zero files is broken.

Glob resolution respects repository ignore rules, such as `.gitignore`, by default. Ignored files are excluded from glob target sets unless the inline link sets `include_ignored = true`. Explicit path links may target ignored files when the file exists.

Path and glob target fingerprints are based on raw file contents and, for globs, the sorted resolved file set. Tree-sitter does not define the identity of path or glob links.

Symbol links are resolved structurally with Tree-sitter where a supported grammar exists. Source files and generated verification entries store symbol targets in canonical file-scoped `path#symbol` form. The symbol portion is a dotted symbol path made from named structural declarations, such as classes, structs, interfaces, traits, enums, functions, methods, and similar top-level or nested declarations. Symbol links do not target arbitrary expressions, local variables, anonymous callbacks, or line numbers in the baseline system. Unsupported languages, parse failures, and unresolved symbols are broken targets. Diagnostics should distinguish `unsupported-language`, `parse-failed`, and `symbol-not-found`. Symbol target fingerprints are based on the resolved symbol body or syntax node.

When a link needs to be mended, the system will notify the user in multiple ways:

- CLI output
- TUI notifications/modal popup and a notification dot

Notifications must explain why the relationship needs attention. At minimum, the system reports whether the relationship has no verification entry, the rule fingerprint changed, the link fingerprint changed, the target fingerprint changed, the target no longer resolves, the symbol language is unsupported, symbol parsing failed, the symbol was not found, or the link definition is invalid.

TODO: Define the work flow for mending links, and the user experience around it.

`.know/linkVerification.toml` records the rule, link, and target fingerprints that were current when the user verified the rule-link-code relationship. The file is machine-produced, deterministic, and committed to Git. A verified relationship has to match all three current fingerprints. If the code, rule, or link definition is updated, the relationship becomes unverified and needs to be verified again. Know can recompute current fingerprints at any time, but it only updates `.know/linkVerification.toml` when the user verifies the relationship.

`.know/linkVerification.lock.toml` records the latest computed status reflection for rule-link-code relationships. It is machine-produced, deterministic, and committed to Git. It is not authoritative unless `know check` recomputes the same expected lockfile from the current `.know` source files and repository code.

Historical changes are documented in git. Not by the know system itself. The know system only documents the current state of the links, rules, and concepts.

### read model

The generated read model stores normalized rule, concept, link, target, status, diagnostic, and search data. It is ephemeral: the source of truth is always the source files and `.know/linkVerification.toml`, while the committed lockfile is the reviewable generated reflection. The read model can be recreated at any time by re-indexing the current source files, approval file, and repository targets.

The read model is Know's operational read surface. Normal read commands query it instead of using reparsed `.know` source files as their answer path. It is only written to by the indexer, and read-only for all other purposes. It provides fast access to rules data for command-line and interactive flows, and provides the query surface for semantic search.

SQLite mirrors the query-relevant records from `.know/linkVerification.lock.toml`: link status, status reasons, unlinked rules, and lockfile hashes. This is needed because commands do not only display the lockfile; they join status data with rules, concepts, resolved targets, diagnostics, and search documents. The committed lockfile remains the reviewable generated artifact, while SQLite is the fast query projection.

Generated local data lives under `.know/cache/`. The SQLite read model is stored at `.know/cache/know.sqlite`; the semantic search index stores its generated files under `.know/cache/semantic/`. `know init` creates `.know/.gitignore` so `cache/` is ignored by Git.

The active read model stores `source_model_hash`, `link_verification_hash`, `link_verification_lock_hash`, `resolved_model_hash`, and schema/contract versions used for freshness checks. If semantic search uses files outside SQLite, those files must store the same `resolved_model_hash` as the SQLite read model.
