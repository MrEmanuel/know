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

Know source files are TOML and are parsed through `serde`.

`serde` owns deserialization into typed config structs. Validation, normalization, and indexing are system concerns, not serde concerns.

## Tree-sitter

Tree-sitter is used for language-aware code analysis.

Symbol targets use Tree-sitter where a supported grammar exists. Unsupported languages or unresolved symbols should fail loudly or remain unverified rather than silently guessing.

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

Tree-sitter is an enhancement and resolution layer, not the storage source of truth. Source TOML files and `.know/verification.toml` remain authoritative.

## Code target resolution

Path and glob targets are resolved through deterministic filesystem matching from the repository root. Their verification fingerprints are based on raw file contents and resolved file sets, not Tree-sitter syntax nodes.

Tree-sitter may enhance browsing, authoring, previews, search chunking, repair suggestions, and reporting for path and glob targets, but it does not change their source-of-truth identity.

## Local read model

SQLite is the generated local read model.

The durable source of truth is the `.know` TOML files. SQLite can be deleted and rebuilt from those files. The indexer is the only writer; command and TUI flows read from it.

Rust access to SQLite uses `sqlx`.

## Semantic search

Semantic search is implemented as a generated index attached to the local read model.

The exact vector extension/model is not yet selected. The system design should only assume that semantic search can index rules, concepts, and inline rule links, and that the index can be regenerated from source files.

## Filesystem matching

Glob and path resolution should use a dedicated Rust glob/matcher library rather than ad hoc string matching.

The exact crate is not yet selected. The important implementation requirement is deterministic matching from the repository root, with ignored/generated files handled consistently.
