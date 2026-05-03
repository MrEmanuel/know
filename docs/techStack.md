## Know tech stack

The Know system is Rust based tool that connects rules to code. It uses a local SQL database for storing rules, concepts, and links, and a terminal user interface(TUI) built with Ratatui. The CLI is implemented using clap, and the config parser uses serde for parsing the .toml files.

### treesitter

Connects links to source code.
Makes code reference in CLI clickable.

### sqlite

local sql database, with semantic vector search.

/// Need to think through the connections here. What EXACTLY are we storing!?
// How are souce code stored? globs resolved (original still stored)
// Do we need to store any source code? Can we rely on treesitter instead?

- All the data from the raw .toml files.
- Parsed .toml file data (resolved globs, etc)

### clap

rust-based CLI using clap. Sequence of commands and options described in CLI.md

### Ratatui

Rust-based Ratatui. Used for the TUI, described in TUI.md

#### Serde

Rust-based parser, using serde. Used for the config parser, described in configParser.md

// TODO: Rewrite this section to be based on the actual tech stack used, not the modules.

### Config validator

### Link validator

Validates the relationship rule - link - code
It uses hashes as source of truth. If the code changes, the link becomes unvalidated, and needs to be validated again. This ensures that the rules are always up to date with the code they reference.

### SQL database

A local SQL database, using sqlx, and a vector addon/plugin for semantic search.
