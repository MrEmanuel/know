# Config parser

Parse the already schema-validated config.
Resolve inline rule links, globs, extract rules, concepts, and other relevant information from the config files.
Store the parsed data in a structured format in the generated read model, and prepare data for semantic search.

The parser does not own generated artifact replacement. The indexer owns atomic full rebuilds and swaps the committed lockfile and generated cache data into place only after the full indexing pipeline succeeds.

The same validation, parsing, link-resolution, fingerprinting, and status-derivation logic is also used by `know check` in read-only mode. In that mode, `.know/linkVerification.lock.toml` and generated cache files are not written or replaced.

For tech stack, see `../techStack.md`.
