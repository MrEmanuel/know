# Indexer

The indexer builds Know's committed link-verification lockfile, generated local read model, and semantic search index from the knowledge files in `.know/` plus current repository targets.

The source of truth is the human-authored TOML files plus `.know/linkVerification.toml`. `.know/linkVerification.lock.toml` is a committed generated reflection of current derived link-verification state. The generated cache is disposable and can always be rebuilt with `know index`.

## Prior art

Know's indexing model follows patterns from mature local-index and build-cache systems rather than inventing a novel cache model.

- Git's index stores sorted repository-relative path entries, object identifiers, stat data, checksums, and optional extensions. Its cache extensions also record environment and ignore-rule inputs needed to decide whether cached data is usable.
- Bazel treats cache outputs as the result of actions with explicit inputs, output names, command-line data, and environment. Reusable outputs are keyed from the data that could affect the result.
- Lockfiles make generated state reviewable in Git while still requiring a freshness check against the real inputs.
- SQLite provides the transactional storage layer for the read model. Its atomic commit behavior makes it a good fit for storing a complete generated projection as one consistent database.
- SQLite FTS5 external-content indexes show the main risk of side indexes: the search index and content tables must be kept consistent. Know must therefore tie semantic search files to the same resolved model hash as SQLite.
- LSIF, SCIP, and CodeQL all persist analyzer output so tools can answer later queries without rerunning the analyzer. The useful boundary is a stable query surface, not exposing internal storage tables as the compatibility contract.
- Filesystem watchers are useful for triggering rebuilds, but watcher events are not a correctness boundary. Editors and filesystems report changes differently, and some filesystems can miss events.

Useful references:

- [Git index format](https://git-scm.com/docs/index-format)
- [Bazel remote caching](https://bazel.build/remote/caching)
- [SQLite atomic commit](https://www.sqlite.org/atomiccommit.html)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [Language Server Index Format](https://code.visualstudio.com/blogs/2019/02/19/lsif)
- [SCIP Code Intelligence Protocol](https://scip-code.org/)
- [CodeQL overview](https://codeql.github.com/docs/codeql-overview/about-codeql/)
- [Rust notify crate](https://docs.rs/notify/)

## Baseline model

The baseline indexer performs an atomic full rebuild.

It runs the validation, parsing, analysis, lockfile generation, and projection pipeline from scratch. The indexer writes generated data to temporary locations and only replaces the active lockfile and cache after the full pipeline succeeds.

If validation, parsing, link resolution, lockfile generation, read-model generation, or semantic-index generation fails, the existing active lockfile and cache remain unchanged.

Incremental indexing is a possible future optimization. It must preserve the same freshness rules as the full rebuild.

## Pipeline boundaries

The indexer should be simple. It does not own source validation, target resolution, verification semantics, or `.know/linkVerification.toml` writes.

The indexing pipeline has three deterministic models:

1. The config parser produces a source model from validated rule and concept TOML files.
2. The link verification parser reads `.know/linkVerification.toml` into an approval model.
3. The analyzer combines the source model, approval model, current repository targets, and resolver settings into a resolved model.

The resolved model contains the clear, ready-to-consume facts that command and TUI flows need: rules, concepts, inline links, resolved targets, target fingerprints, verification state, unlinked state, diagnostics, lockfile records, and search documents.

The indexer consumes the resolved model and writes two generated outputs: a committed `.know/linkVerification.lock.toml` reflection for review, and disposable cache data in SQLite and the semantic search index for fast reads. The database is a read model, not the source of truth.

## Link verification ownership

`.know/linkVerification.toml` is written by verification workflows, not by indexing.

`know verify` uses the same validation, target-resolution, and fingerprinting logic as the analyzer. After the user approves a rule-link-code relationship, the link verification writer records the current rule, link, and target fingerprints in `.know/linkVerification.toml`.

`know index` only reads `.know/linkVerification.toml`. It must not update approval fingerprints as a side effect of indexing.

## Link verification lockfile

`.know/linkVerification.lock.toml` is written by analysis workflows, not by manual editing.

The lockfile stores the latest computed link-verification reflection: source and approval-file hashes, the resolved model hash, each link's derived status, status reasons, and unlinked rules. It is deterministic, human-readable, and committed to Git so current Know state can be reviewed with normal version-control tools.

The lockfile is not authoritative by itself. A relationship is currently verified only when the analyzer recomputes the same result from knowledge files, `.know/linkVerification.toml`, current repository targets, and resolver settings. If the recomputed expected lockfile differs from the committed lockfile, the committed reflection is stale.

The lockfile intentionally does not duplicate the per-link approval fingerprints stored in `.know/linkVerification.toml`. It stores `link_verification_hash` and derived status records instead. This keeps approval fingerprints in one file while still making approval changes visible through the lockfile hash and any resulting status changes.

`know check` recomputes the expected lockfile in read-only mode and reports `stale-lockfile` when it differs. `know index` writes the expected lockfile and rebuilds the disposable cache. `know verify` updates `.know/linkVerification.toml`, then recomputes and writes the lockfile from the new approved fingerprints.

## Read model projection

SQLite is Know's operational read projection. The source of truth remains the
human-authored `.know` TOML files plus `.know/linkVerification.toml`, but normal
read commands query the active read model instead of reparsing knowledge
files as their answer path.

SQLite mirrors the lockfile's query-relevant data because most commands need to join link-verification state with other generated data.

At minimum, the read model stores:

- metadata from the current analysis: `source_model_hash`, `link_verification_hash`, `link_verification_lock_hash`, `resolved_model_hash`, schema versions, and stable-view contract versions
- one row per `.know/linkVerification.lock.toml` `[[links]]` entry: owning rule ID, link kind, canonical target, status, and status reasons
- one row per `.know/linkVerification.lock.toml` `[[unlinked_rules]]` entry
- normalized rule, concept, inline link, resolved target, diagnostic, and search-document data needed to join those status records to user-facing output

This duplication is intentional. `.know/linkVerification.lock.toml` is optimized for Git review; SQLite is optimized for queries. `know context` needs fast target-to-rule joins with status data, `know rule list` and `know rule show` need normalized rule and link records, `know status` and `know report` need counts and grouping by status/reason, `know query` needs stable SQL views, `know browse` needs interactive filtering, and semantic search may use status as a facet.

For example, "list all code locations this rule points to" is a join across the
rule, its inline links, resolved targets, and current verification status. The
source TOML is still authoritative, but SQLite is the structured read surface
for that already-indexed relationship data.

The stable SQL views should expose lockfile-derived data through `link_verification_status` and `unlinked_rules`. Internal tables may store current and approved fingerprints when useful for diagnostics or future incremental indexing, but stable views should not require callers to depend on raw fingerprint values.

## Index hashes

Know stores hashes instead of generation IDs.

At minimum, the active SQLite read model stores:

- `source_model_hash` - hash of the deterministic config parser output
- `link_verification_hash` - hash of the normalized approval model from `.know/linkVerification.toml`
- `link_verification_lock_hash` - hash of the normalized `.know/linkVerification.lock.toml` reflection written from the resolved model
- `resolved_model_hash` - hash of the deterministic resolved model after target resolution, fingerprinting, status derivation, and diagnostic generation
- `read_model_schema_version`
- `stable_view_contract_version`
- semantic-search index format and model settings, when semantic search is enabled

The separate source and link-verification hashes are useful for diagnostics and future partial rebuilds. They are not enough on their own to decide freshness, because code can change while both TOML-derived hashes stay the same.

Freshness is based on `resolved_model_hash`, because it includes current target resolution and fingerprints. The lockfile stores that hash as metadata; the hash is computed from the resolved model inputs and derived facts, not from the serialized lockfile that contains it.

If semantic search uses files outside SQLite, those files must record the same `resolved_model_hash` and compatible semantic-search settings. Know must treat the semantic search index as missing or stale if its stored hash does not match SQLite.

## Freshness

Freshness is the claim that the active generated artifacts were produced from
the current knowledge files, approval file, resolver inputs, repository targets,
and semantic-search settings.

`know check` and `know index` prove freshness by recomputing the current
resolved model, comparing its hash with `resolved_model_hash` stored in the
active SQLite read model, and comparing the expected link-verification lockfile
with `.know/linkVerification.lock.toml`.

Freshness detection is automatic for commands that depend on generated state.
Like `git status` or `git diff`, these commands may inspect current files to
discover that generated state is stale. They still answer from the active read
model, and must not write refreshed artifacts as a side effect.

The committed lockfile is fresh when the recomputed expected lockfile exactly
matches `.know/linkVerification.lock.toml`.

The generated cache is fresh when the recomputed resolved model hash matches
the stored `resolved_model_hash`, the normalized lockfile hash stored in SQLite
matches `.know/linkVerification.lock.toml`, and any semantic-search sidecar has
the same resolved model hash as SQLite.

The committed lockfile is stale when `.know/linkVerification.lock.toml` exists
but differs from the recomputed expected lockfile.

The generated cache is stale when the active cache exists but the recomputed
resolved model hash differs from the stored `resolved_model_hash`, or when
SQLite was built against a different normalized lockfile hash.

The generated cache is missing when `.know/cache/know.sqlite` does not exist or
cannot be opened as a Know read model.

The generated cache is incompatible when the database exists but has an
unsupported application ID, schema version, stable-view contract version, or
required feature set. Incompatible caches should be rebuilt with `know index`.

The resolved model hash includes at least:

- the deterministic config parser output
- the normalized approval model
- source schema and validation-rule versions
- resolver settings and resolver-version inputs that can affect target resolution
- ignore files and ignore settings that can affect glob target sets
- each resolved path target and its content fingerprint
- each resolved glob target set, in sorted order, plus the content fingerprints of matched files
- each resolved symbol target and its symbol fingerprint
- Tree-sitter grammar identities or versions used for symbol resolution
- semantic-search model, tokenizer, chunking, and index-format inputs

File mtimes, filesystem events, and cached stat data may be used as performance optimizations, but they are not the source of truth for freshness.

## Command behavior

`know index` writes `.know/linkVerification.lock.toml`, a new SQLite read
model, and semantic search index from the current resolved model.

`know context`, `know search`, `know browse`, `know query`, `know status`,
`know report`, and read-only `know rule` commands are read commands. They read
from the active read model and may inspect enough current state to detect stale
generated views, but they do not write `.know/linkVerification.lock.toml`
or cache files. Commands that require fresh data must prove the active read
model corresponds to the current inputs before answering.

`know check` recomputes the resolved model and expected lockfile in read-only
mode. It reports stale lockfiles by comparing the expected lockfile with
`.know/linkVerification.lock.toml`. It may also report cache freshness by
comparing hashes, but its source health result does not depend on the generated
cache.

`know watch` watches for likely changes and triggers rebuilds of the lockfile
and cache. It is the recommended refresh path for interactive editing sessions.
It must not rely on watcher events as proof of freshness.
