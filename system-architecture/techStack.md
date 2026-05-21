# Know tech stack

This document records the implementation choices for Know. System behavior, module boundaries, and workflows are described in `docs/systemModules/`.

## Language and runtime

Know is implemented in Rust.

Rust is a good fit because Know is a local CLI tool that needs fast startup, predictable filesystem access, portable binaries, and embeddable parsing/indexing libraries.

## Command-line interface

The command-line interface uses `clap`.

`clap` owns command definitions, argument parsing, flags, help output, and shell completion support. Command behavior is described in `docs/systemModules/CLI.md`.

## Terminal interface

The interactive terminal interface uses `Ratatui`.

`Ratatui` owns terminal layout, keyboard interaction, panes, lists, and modals. TUI behavior is described in `docs/systemModules/TUI.md`.

## Config parsing

Knowledge files are TOML and are parsed through `serde`.

`serde` owns deserialization into typed config structs. Validation, normalization, and indexing are system concerns, not serde concerns.

## Tree-sitter

Tree-sitter is used for language-aware code analysis.

Symbol targets use canonical file-scoped `path#symbol` form in knowledge files and generated verification entries. Tree-sitter resolves the symbol portion where a supported grammar exists. The symbol portion is a dotted symbol path made from named structural declarations, such as classes, structs, interfaces, traits, enums, functions, methods, and similar top-level or nested declarations. Unsupported languages, parse failures, and unresolved symbols are broken targets rather than unverified relationships.

Tree-sitter also powers code-aware user experience features in the CLI, TUI, read model, and search index where supported grammars are available. These features include:

- syntax-highlighted code previews
- file outlines for classes, functions, methods, structs, interfaces, and similar symbols
- breadcrumbs for selected code targets
- symbol suggestions when authoring links
- structural folding in previews
- focused snippets for symbol links
- nearby symbol context for path and glob links
- code-aware chunks for semantic search
- repair suggestions when a symbol link no longer resolves
- coverage reporting by top-level symbol where the language grammar supports it

Tree-sitter is an enhancement and resolution layer, not the storage source of truth. Source TOML files and `.know/linkVerification.toml` remain authoritative. `.know/linkVerification.lock.toml` is the committed generated reflection of the current analysis.

## Code target resolution

Path and glob targets are resolved through deterministic filesystem matching from the repository root. Source targets and generated verification entries use normalized repository-root-relative paths with `/` separators. Path targets resolve to one repository file only; directories require glob targets. Glob targets resolve to repository files only, excluding directories. Glob resolution respects repository ignore rules, such as `.gitignore`, by default, with an explicit `include_ignored = true` escape hatch on glob links. Their verification fingerprints are based on raw file contents and resolved file sets, not Tree-sitter syntax nodes.

Tree-sitter may enhance browsing, authoring, previews, search chunking, repair suggestions, and reporting for path and glob targets, but it does not change their source-of-truth identity.

## Local read model

SQLite is the generated local read model and the operational read projection for normal read commands.

The durable source of truth is the human-authored `.know` TOML files plus `.know/linkVerification.toml`. `.know/linkVerification.lock.toml` is a committed generated reflection, not an approval source. SQLite can be deleted and rebuilt from the current knowledge files, approval file, and repository targets. The indexer is the only writer; command and TUI flows read from it.

Deleting SQLite does not lose project knowledge, but cache-backed read commands such as `know context`, `know rule list`, `know status`, `know report`, `know browse`, `know search`, and `know query` require a compatible generated read model. `know check` is the read-only source-recompute path that validates current source state without trusting the generated cache.

The SQLite database lives at `.know/cache/know.sqlite`. Generated semantic search files live under `.know/cache/semantic/`. The cache directory is ignored by Git.

`know index` performs an atomic full rebuild of the committed lockfile and generated cache. It writes to temporary locations and replaces the active lockfile and cache only after the full indexing pipeline succeeds.

The read model stores `source_model_hash`, `link_verification_hash`, `link_verification_lock_hash`, `resolved_model_hash`, and schema/contract versions used for freshness checks. `know check` and `know index` prove freshness by recomputing the resolved model and expected lockfile, then comparing them with the stored values and committed lockfile. Normal read commands answer from SQLite and may inspect current files only to detect or enforce freshness; file mtimes alone are not the correctness boundary.

Rust access to SQLite uses `sqlx`.

## Semantic search

Semantic search is implemented as a generated index attached to the local read model.

The exact vector extension/model is not yet selected. The system design should only assume that semantic search can index rules, concepts, and inline rule links, and that the index can be regenerated from knowledge files.

If semantic search uses generated files outside SQLite, those files must store the same `resolved_model_hash` as the SQLite read model. A semantic index with a missing or mismatched hash is stale and must be rebuilt.

## Filesystem matching

Glob and path resolution should use a dedicated Rust glob/matcher library rather than ad hoc string matching.

The exact crate is not yet selected. The important implementation requirement is deterministic matching from the repository root, with ignored/generated files handled consistently. Glob matching should respect repository ignore rules by default and support an explicit include-ignored mode for glob links.
