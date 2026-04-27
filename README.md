# know

A Git-native knowledge layer that connects code to the rules it must not
silently break.

> **Goal:** prevent 80-99% of "I didn't know that rule existed" mistakes by
> surfacing relevant rules and rationale before a change is made.

---

# Part 1 - README

## How It Works

```txt
.knowledge/rules/*.md
        ↓
Indexer (know index / know sync)
        ↓
SQLite database (derived, gitignored)
        ↓
know context <path>   ← what humans and agents read
know query "<sql>"
```

- **Rules** are the source of truth: constraints, rationale, review state, and
  anchors in Markdown.
- **Anchors** connect rules to code with `symbol:`, `path:`, or `glob:`.
- **Concepts** are optional vocabulary. They are context reached through a
  matching rule, not the center of the system.
- **SQLite** is a fast, disposable read model. The indexer is the only writer.
- **Git** provides history, review, and collaboration.

## Install And Develop

```bash
yarn install
yarn test
yarn build
```

In this repository, use the package script:

```bash
yarn know index
yarn know context src/labels/visibility.ts
yarn know status
```

When `know` is installed in another project, invoke it through that project's
package manager unless the binary is installed globally:

```bash
npx know context <path>       # npm projects
yarn know context <path>      # Yarn projects
pnpm know context <path>      # pnpm projects
```

Inside package scripts, `know` is available from `node_modules/.bin`:

```json
{
  "scripts": {
    "know": "know",
    "know:context": "know context src/example.ts"
  }
}
```

## Initialize A Repository

```bash
know init
```

This creates the `.knowledge/` source tree, ignore rules for generated
indexes, and concise AI-agent instructions:

```txt
.knowledge/agent-instructions.md
AGENTS.md
```

`AGENTS.md` receives a managed `know` block. Existing content is preserved
between:

```md
<!-- know:start -->
<!-- know:end -->
```

Repeated `know init` runs are safe and idempotent.

### Init Flags

```bash
know init --dry-run
know init --agent-files
know init --no-agent-files
```

If agent-specific files already exist, `know init` inserts or updates a
managed reference in them. Missing ones are not created unless
`--agent-files` is passed.

## Folder Layout

```txt
.knowledge/
  rules/       labels.md, item-maturity.md   ← source of truth
  concepts/    label.md, maturity.md         ← optional vocabulary
  agent-instructions.md                      ← runtime contract for agents
  indexes/
    knowledge.sqlite                         ← gitignored, generated
```

## File Format

Markdown with YAML metadata. Rules are centered around `##` sections. The
heading slug becomes the rule id: `rules.<file-slug>.<heading-slug>`.

### Rule File - `rules/labels.md`

```markdown
---
concept: concept.label
---

# Label rules

## Personal labels are visible only to their creator
status: active
reviewed: 2026-04-01
anchors:
  - symbol: LabelService.visibleTo
  - path: src/labels/visibility.ts

Regardless of item maturity, personal labels never leak to other users.

### Rationale

Personal labels are private organization state. Showing them to other users
leaks one user's organization model into another user's workspace.

## Personal labels are dropped on cross-user copy
status: active
reviewed: 2026-04-12
anchors:
  - symbol: copyDocument
  - symbol: Item.duplicate

When user A duplicates an item owned by user B, personal labels are dropped.
Shared labels follow.

### Rationale

Copying a colleague's item should copy shared data, not the colleague's
private organization model.
```

### Optional Concept - `concepts/label.md`

```markdown
---
id: concept.label
title: Label
related: [concept.maturity]
---

# Label

A user-visible marker attached to items.

Labels behave differently depending on the maturity of the item they attach to.
```

Concepts remove repetition when many rules share vocabulary. They are not
required for Know to work.

### Cross-References

- `concept:` in rule metadata links a rule to optional vocabulary.
- `related:` in concept metadata links concepts to each other.
- `[[concept.label]]` wiki links are indexed into the same link table.

## Anchors

Anchors connect rules to code. Three forms, in order of preference:

| Form      | Example                          | When                           |
| --------- | -------------------------------- | ------------------------------ |
| `symbol:` | `symbol: LabelService.visibleTo` | Rule tied to specific behavior |
| `path:`   | `path: src/labels/visibility.ts` | Rule tied to one file          |
| `glob:`   | `glob: src/labels/**`            | Cross-cutting concern          |

Symbol resolution uses **tree-sitter** at index time: no LSP server, no
project-wide language service. A resolved symbol anchor records the file path,
file hash, and file modification time.

Resolution outcomes:

- `resolved` - symbol/path/glob found.
- `broken-anchor` - symbol no longer exists, or path/glob matches nothing.

## Drift And Staleness

Two dimensions matter per rule:

1. **Anchor health** - does the referenced code still exist?
   - `resolved` means the anchor is healthy.
   - `broken-anchor` means Know cannot find the code the rule points at.

2. **Freshness** - has anchored code changed since review?
   - Any anchored file changed after `reviewed:` makes the rule `stale`.
   - Stale does not mean wrong. It means re-confirm intent.

### Re-Confirming A Rule

```bash
know review <rule-id>
```

This stamps `reviewed: <today>` on the rule and re-indexes. You can also edit
`reviewed:` manually.

## CLI

| Command                 | Purpose                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `know init`             | Scaffold `.knowledge/`, install `AGENTS.md` block + `agent-instructions.md` |
| `know index`            | Parse files, resolve anchors, write SQLite                                  |
| `know sync`             | Re-index only when `.knowledge/` files changed                              |
| `know status`           | Counts: active / stale / broken-anchor rules                                |
| `know context <path>`   | The 95% command: rules and rule-linked context touching a path              |
| `know query "<sql>"`    | Read-only SQL access                                                        |
| `know query --schema`   | Print schema + example queries                                              |
| `know review <rule-id>` | Stamp `reviewed:` in rule metadata                                          |

## `know context <path>`

`know context` starts with rules whose anchors touch the target path. Only
after a rule matches does Know return supporting context such as inline
rationale and linked concepts.

```bash
know context src/labels/visibility.ts
```

Example output:

```markdown
# Knowledge for src/labels/visibility.ts

## Active rules (1)

### Personal labels are visible only to their creator [active, reviewed 2026-04-01]

Regardless of item maturity, personal labels never leak to other users.

Rationale:

Personal labels are private organization state. Showing them to other users
leaks one user's organization model into another user's workspace.

## Stale rules (1)

### Personal labels are dropped on cross-user copy [stale: src/labels/visibility.ts changed ...]

...

## Connected concepts

- concept.label - Label - A user-visible marker attached to items.

## Broken anchors touching this file

(none)
```

Always returns:

1. Active rules whose anchors match the path.
2. Stale rules whose anchors match the path, with a reason.
3. Inline rationale for each returned rule.
4. Concepts linked from those returned rules.
5. Broken anchors from the same rule files, if any.

Path-only granularity is v1. `--symbol` is deferred.

## `know query` - Read-Only SQL

```bash
know query "SELECT id, statement FROM rules WHERE status = 'active'"
know query --schema
```

- Connections open SQLite read-only.
- The `anchors_match(path)` helper is registered at connection time.
- SQL is the API; there is no server or protocol in v1.

## Agent Integration

No MCP, no extension. Two files do the work:

- **`AGENTS.md`** - managed block points agents at
  `.knowledge/agent-instructions.md`.
- **`.knowledge/agent-instructions.md`** - the runtime contract.

For this repository, the instruction is:

```bash
yarn know context <path>
```

That matters because the package binary may not be globally installed. In
other repositories, use the package-manager invocation that works there.

## Workflow

```txt
edit .knowledge/rules/*.md  →  know index  →  git commit
                                  ↑
             agent runs package-manager know context before editing code
```

## Schema (Read Model)

```sql
CREATE TABLE items (
  id TEXT PRIMARY KEY,         -- concept.label, rules.labels.<slug>
  kind TEXT NOT NULL,          -- concept | rule
  title TEXT,
  path TEXT NOT NULL,
  body TEXT NOT NULL,
  frontmatter_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  statement TEXT NOT NULL,
  rationale TEXT,
  status TEXT NOT NULL,        -- active | stale | broken-anchor | deprecated
  reviewed_at TEXT
);

CREATE TABLE anchors (
  id INTEGER PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,          -- symbol | path | glob
  value TEXT NOT NULL,
  resolved INTEGER NOT NULL,
  resolved_path TEXT,
  file_hash TEXT,
  last_changed_at TEXT
);

CREATE TABLE links (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT                -- wiki | related | concept
);
```

## Indexer Flow

```txt
.knowledge/*.md → parse rules and optional concepts
                → resolve rule anchors (tree-sitter, glob, path)
                → hash anchored files
                → compare against review date → compute status
                → write items, rules, anchors, links
```

The database is reproducible from files and is never committed.

---

# Part 2 - Design

## Problem Framing

Codebases accumulate rules that are not in the code: business decisions,
domain quirks, RBAC subtleties, edge cases, and "this is why it works this
way" reasoning. When that knowledge lives only in people's heads or scattered
systems, people and agents make confident changes that violate invariants they
never saw.

Know exists to make those rules explicit, versioned, and surfaced exactly
when they matter: before code is changed.

## First Principles

Stripped down, Know is about **propositions about code that need to be
re-examined when that code changes**.

Two obligations follow:

1. **Findability** - when I am about to touch X, I learn which rules touch X.
2. **Faithfulness** - when X changes, those rules are visibly stale until
   someone re-confirms them.

Everything else is a means to those ends.

## Forcing Constraints

| Constraint                        | Implication                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Must survive a person leaving     | Plain text + Git                                                               |
| Must survive a refactor           | Anchors must be semantic where possible                                        |
| Must survive a rename             | Anchors should move with symbols, or break loudly                              |
| Must be cheap to write            | One rules file per area, no IDs to invent                                      |
| Must be cheap to read for agents  | Small focused output from `know context`                                       |
| Must distinguish stale from wrong | A rule from 2022 must visibly age, not silently lie                            |
| Truth lives in code, not docs     | Code is canonical for behavior; knowledge is canonical for intent              |

## Principles

1. **Rules are the center.** A rule owns its anchors, status, rationale, and
   review date.
2. **Files are the source of truth.** Markdown + YAML in Git.
3. **SQLite is a disposable read model.** Only the indexer writes to it.
4. **Knowledge is commentary; code is canonical for behavior.** Knowledge is
   canonical for intent.
5. **Pre-change awareness beats post-change validation.**
6. **Boring beats clever.** Anchors are paths, globs, and symbol names.

## First-Class Citizens

Only two primitives are load-bearing:

| Primitive  | What it gives                                      |
| ---------- | -------------------------------------------------- |
| **Rule**   | Constraint, rationale, review state, and lifecycle |
| **Anchor** | The connection from a rule to code                 |

Everything else is context:

| Context       | Role                                                                  |
| ------------- | --------------------------------------------------------------------- |
| **Rationale** | Required rule content, usually inline under `### Rationale`           |
| **Concept**   | Optional vocabulary and grouping for repeated domain nouns            |
| **Graph**     | Emergent from metadata and wiki links                                 |
| **Database**  | Read model, not part of the authoring loop                            |

This is the simplification: rationale remains essential, but it is not a
separate first-class artifact by default. Concepts are useful, but optional.

## Key Design Decisions

### Why Inline Rationale

Most rules have a 1:1 relationship with their rationale. Splitting that into a
separate file makes common authoring slower and increases the chance that the
why is missing, stale, or not read. Inline rationale keeps the constraint and
the reason together in the `know context` output.

If a rationale becomes large or shared across many rules, it can still be
linked with normal Markdown. That is an escape hatch, not the default model.

### Why Optional Concepts

Concepts are helpful when a domain noun appears across many rules. They remove
repetition and give agents vocabulary. But the system still works without
them, so they should not be treated as required structure.

### Why One File Per Concept Area

Authoring overhead kills adoption. A human reading about labels should open
`rules/labels.md` and see all label rules together, each as a `##` section.
The indexer reconstitutes those sections into rule rows.

### Why Tree-Sitter, Not LSP

- Language-aware symbol discovery without a running server.
- Fast and embeddable.
- Accurate enough for "find this symbol's defining file."

LSP can be layered in later if a real need appears.

### Why File MTime, Not Symbol-Body Hash

Symbol-body hashing requires per-language extraction logic. File-level
freshness is simple, portable, and good enough for v1. If a large file creates
too much staleness noise, that is useful pressure to move rule-relevant code
into a smaller module.

### Why Stale Never Means Wrong

A file changing does not mean the rule is invalid. It means the rule must be
re-confirmed:

```txt
active → stale (anchored file changed)
stale  → active (reviewer confirms) OR → deprecated (rule no longer holds)
```

### Why Anchor Health And Freshness Are Separate

- `broken-anchor` is loud: the code a rule points at no longer exists.
- `stale` is quieter: the code exists, but changed after review.

Conflating those signals would make both less useful.

### Why No In-Code Anchor Comments In V1

Inline source comments such as `// know:rule(...)` would be refactor-robust,
but they require touching application code to add knowledge. V1 keeps
knowledge outside the source tree.

### Why No Executable Rules In V1

A rule linked to a passing test is ideal, but many rules are not easily
mechanizable. V1 proves the awareness loop first.

### Why Pre-Change Awareness, Not CI Bots First

The highest leverage moment is before the edit. For AI agents, the right rule
in prompt context is more valuable than a post-hoc warning after code has
already been changed.

### Why SQL, Not MCP

LLMs can write SQL, SQLite has a stable read-only mode, and no server lifecycle
is required. MCP can be added later without changing the authoring model.

### Why `know context` Starts From Rules

This is the main UX rule: a path should return rules touching that path, and
only then supporting context reached through those rules. Directly anchored
concepts are not enough to trigger output. This keeps `know context` focused on
the constraints that can be broken by the pending change.

## Prior Art

| System                              | Borrowed idea                                                        |
| ----------------------------------- | -------------------------------------------------------------------- |
| ADRs                                | Capture the why, but inline by default here                          |
| Docs-as-code                        | Markdown in repo, reviewed via PR                                    |
| CODEOWNERS                          | Tiny, glob-based, repo-native metadata                               |
| Sourcegraph / LSP / tree-sitter     | Symbol references survive simple moves                               |
| Cursor/Copilot rules, AGENTS.md     | Agents read short scoped instruction files                           |
| Obsidian / Logseq                   | Wiki links are lightweight graph syntax                              |
| Pact / property-based tests         | Executable rules are the long-term ideal                             |

## Out Of Scope For V1

- PR bot / GitHub Action / CI checks
- IDE extension / CodeLens
- In-code anchor comments
- Executable rule anchors (`test:`)
- Symbol-level `know context --symbol`
- Web UI
- Multi-repo federation

## Future TODOs

- **Validation.** Add schema/config validation for knowledge files. Apple's
  Pkl is worth evaluating, along with JSON Schema, CUE, or another validation
  format that can validate rule metadata without making authoring painful.
- **Embeddings / semantic recall.** Revisit if path-based anchor retrieval is
  not enough.
- **JSON output for `know context`.** Markdown is enough for v1.
- **Shared rationale links.** Add a documented pattern if real rules show
  repeated large rationale text.

## Summary

```txt
Code         → what the system does
Rules        → what must remain true, and why
Anchors      → which code can affect those rules
know context → what gets read at the moment of change
```
