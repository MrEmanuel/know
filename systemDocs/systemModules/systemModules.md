# Know system design

This document describes the overall system design of Know, including its components, their interactions.

For specific details on the CLI commands, tech stack, file structure, syntax, and primitives, please refer to the respective documents in the systemDocs directory.

## System modules

### core

Shared core logic, data structures, and utilities used across the system.

### cli

The command-line interface for Know, implemented in Rust using clap. It provides various commands for interacting. The cli is the main entry point for users to interact with the system. It can start the interactive TUI, execute commands, and perform operations like indexing, searching, and validating.

### tui

A terminal user interface built with Ratatui, allowing users to browse and edit rules, concepts, and links in an interactive way.

### config parser

ETL format parser, extracting relevant information from the config files, transforming it into a structured format, and loading it into the local SQL database. This includes resolving globs, extracting rules, concepts, links, and other relevant information from the config files.

SQL database schema design and vector embedding generation for semantic search are also part of the config parser's responsibilities.

### config validator

Ensures that the configuration files provided by the user are correct, complete, and adhere to the expected schema before any parsing or processing occurs.

### link validator

1. User defines a link between a rule and code.
2. Link validator checks both files exist.
3. It hashes the rule.
4. It hashes the code.
5. User validates the link.
6. The result is saved. (in relevant links/\*.toml file, and parsed and stored in the local sql db)
7. Later, if any hash/version changes, the link becomes unvalidated.

A link can be either:

Valid | Unvalidated | Invalid

Valid if it's not invalid, and has been validated.
Unvalidated if the code or the rule has changed since the last validation, but it has not been checked again.
Invalid if the code or the rule it links to does not exist, or if the link itself is not properly defined.

When a link needs to be mended, the system will notify the user in multiple ways:

- CLI output
- TUI notifications/modal popup and a notification dot
  Options below are speculative, future features:
- git hooks - pre-commit hook that checks for unvalidated links and prevents commit, or at least warns the user.
- Github actions
- Github agent
- Jira integration

TODO: Define the work flow for mending links, and the user experience around it.

Links keep track of when a link was updated, and when the code it links to was updated. A verified link (e.g verified rule through a link) has to be newer than the code it links to. If the code is updated, the link becomes unverified, and needs to be verified again. This ensures that the rules are always up to date with the code they reference.

Historical changes are documented in git. Not by the know system itself. The know system only documents the current state of the links, rules, and concepts.

### database

A local SQL database,with a schema designed to store the parsed rules data. The SQL database is the L in the ETL system, and is considered ephemeral, as it's only a local cache of the data from the .toml files. The source of truth is always the .toml files, and the SQL database can be recreated at any time by re-parsing the .toml files.

The SQL database is only written to by the config indexer, and read-only for all other purposes. The SQL database is used to provide fast access to the rules data for the CLI and TUI, and to provide semantic search capabilities through vector embeddings.
