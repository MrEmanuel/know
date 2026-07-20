# Working in Know

Know is an active-memory system for code. Repository rules live under `.know/`
and are surfaced automatically by the Codex pre-edit hook.

## Before and during edits

- Use `apply_patch` for file edits so the repository hook can inspect every
  affected path.
- Before the first edit to a file in a turn, run
  `know context <path> --format json`. The hook is the automatic safety net,
  not a reason to skip an explicit pre-edit query.
- When the hook returns `KNOW PRE-EDIT CONTEXT`, summarize the relevant
  constraint before editing.
- If the request conflicts with a linked rule, do not silently implement the
  literal request. Explain the conflict and propose an alternative that
  preserves the rule's intent.
- If the hook reports missing or stale generated state, run `know index` and
  query `know context <path>` before continuing.
- Never run `know verify` unless the human explicitly authorizes verification.
  Verification is a review decision, not a routine cleanup step.

## Validation

- Rust: `cargo fmt --all`, `cargo test`, and
  `cargo clippy --all-targets -- -D warnings`.
- SkyRoute: `python3 -m unittest discover -s examples/skyroute/tests`.
- Rule health: `know check`. Changes to linked code are expected to make its
  relationship unverified until a human reviews it.
