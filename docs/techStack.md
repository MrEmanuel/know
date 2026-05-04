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

## Code target resolution

Tree-sitter is used for language-aware code analysis.

Symbol targets use Tree-sitter where a supported grammar exists. Unsupported languages or unresolved symbols should fail loudly or remain unverified rather than silently guessing.
TODO: should file paths and globs also use treesitter?

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
