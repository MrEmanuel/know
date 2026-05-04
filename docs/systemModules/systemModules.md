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
4. It fingerprints the inline link definition.
5. It fingerprints the resolved code target or targets.
6. User verifies the rule-link-code relationship.
7. The result is saved to `.know/verification.toml` and then re-indexed into the generated read model.
8. Later, if the rule, link, or target fingerprint changes, that rule-link-code relationship becomes unverified.

A link can be either:

Verified | Unverified | Broken

Verified if the rule-link-code relationship has been reviewed and the current rule, link, and target fingerprints match the stored verification entry.
Unverified if the code, rule, or link definition has changed since the last verification, or if the relationship has never been verified. Know reports the reason, but both cases use the same `unverified` status.
Broken if the code target no longer resolves, or if the link itself is not properly defined.

Verification status belongs to each rule-link-code relationship. If two rules point to the same code target, each relationship is verified independently.

Inline links do not have source-defined IDs. The read model may assign internal row IDs, but source files identify links by their owning rule and target metadata.

When a link needs to be mended, the system will notify the user in multiple ways:

- CLI output
- TUI notifications/modal popup and a notification dot

Notifications must explain why the relationship needs attention. At minimum, the system reports whether the relationship has no verification entry, the rule fingerprint changed, the link fingerprint changed, the target fingerprint changed, the target no longer resolves, or the link definition is invalid.

TODO: Define the work flow for mending links, and the user experience around it.

`.know/verification.toml` records the rule, link, and target fingerprints that were current when the user verified the rule-link-code relationship. The file is machine-produced, deterministic, and committed to Git. A verified relationship has to match all three current fingerprints. If the code, rule, or link definition is updated, the relationship becomes unverified and needs to be verified again. Know can recompute current fingerprints at any time, but it only updates `.know/verification.toml` when the user verifies the relationship.

Historical changes are documented in git. Not by the know system itself. The know system only documents the current state of the links, rules, and concepts.

### read model

The generated read model stores normalized rule, concept, link, target, and search data. It is ephemeral: the source of truth is always the source files, and the read model can be recreated at any time by re-indexing those files.

The read model is only written to by the indexer, and read-only for all other purposes. It provides fast access to rules data for command-line and interactive flows, and provides the query surface for semantic search.
