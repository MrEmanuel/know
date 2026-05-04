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

### config validator

Ensures that the configuration files provided by the user are correct, complete, and adhere to the expected schema before any parsing or processing occurs.

### link validator

1. User defines an inline link under a rule.
2. Link validator resolves the link target and checks that the referenced code exists.
3. It fingerprints the owning rule.
4. It fingerprints the resolved code target or targets.
5. User verifies the rule-link pair.
6. The result is saved back into the owning rule source file and then re-indexed into the generated read model.
7. Later, if the rule fingerprint or target fingerprint changes, that rule-link pair becomes unverified.

A link can be either:

Verified | Unverified | Broken

Verified if the rule-link pair has been reviewed after the current rule and code fingerprints were recorded.
Unverified if the code or the rule has changed since the last verification, or if the link has never been verified.
Broken if the code target no longer resolves, or if the link itself is not properly defined.

Verification status belongs to each rule-link pair. If two rules point to the same code target, each relationship is verified independently.

When a link needs to be mended, the system will notify the user in multiple ways:

- CLI output
- TUI notifications/modal popup and a notification dot
  Options below are speculative, future features:
- git hooks - pre-commit hook that checks for unverified links and prevents commit, or at least warns the user.
- GitHub actions
- GitHub agent
- Jira integration

TODO: Define the work flow for mending links, and the user experience around it.

Links keep track of when the rule-link pair was verified, the rule fingerprint at that time, and the code target fingerprint at that time. A verified link has to match the current rule and code fingerprints. If the code or the rule is updated, the link becomes unverified and needs to be verified again. This ensures that the rules are always up to date with the code they reference.

Historical changes are documented in git. Not by the know system itself. The know system only documents the current state of the links, rules, and concepts.

### read model

The generated read model stores normalized rule, concept, link, target, and search data. It is ephemeral: the source of truth is always the source files, and the read model can be recreated at any time by re-indexing those files.

The read model is only written to by the indexer, and read-only for all other purposes. It provides fast access to rules data for command-line and interactive flows, and provides the query surface for semantic search.
