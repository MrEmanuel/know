# know

A Git-native knowledge layer that captures the _why_ behind a codebase and
connects it to the code, so humans and AI agents can avoid breaking implicit
rules they didn't know existed.

> **Goal:** prevent 80–99% of "I didn't know that rule existed" mistakes by
> surfacing relevant domain knowledge **before** a change is made.

---

# Part 1 — README (pragmatic)

## How it works

```
.knowledge files (source of truth)
        ↓
Indexer (know index / know sync)
        ↓
SQLite database (derived, gitignored)
        ↓
know context <path>   ← what humans and agents read
know query "<sql>"
```

- **Files** — canonical, version-controlled knowledge in Markdown + YAML.
- **SQLite** — fast, disposable, read-only query layer.
- **Git** — history, review, collaboration.

The indexer is the only writer to SQLite. All edits happen in the files.

## Install & development

```bash
yarn install
yarn test
yarn build
```

## Initialize a repository

```bash
know init
```

This creates the `.knowledge/` source tree, ignore rules for generated
indexes, and installs concise AI-agent instructions:

```txt
.knowledge/agent-instructions.md
AGENTS.md
```

`AGENTS.md` receives a managed `know` block that points agents to the full
workflow. Existing `AGENTS.md` content is preserved between:

```md
<!-- know:start -->
<!-- know:end -->
```

Repeated `know init` runs are safe and idempotent.

### Init flags

```bash
know init --dry-run         # preview without writing
know init --agent-files     # also create CLAUDE.md, .github/copilot-instructions.md, .cursor/rules/know.mdc
know init --no-agent-files  # skip agent-specific files even when they exist
```

If agent-specific files already exist, `know init` inserts/updates a managed
reference in them. Missing ones are not created unless `--agent-files` is
passed.

## Folder layout

```
.knowledge/
  concepts/    item.md, label.md, maturity.md          ← nouns the business cares about
  rules/       labels.md, item-maturity.md             ← invariants, one file per concept area
  rationales/  2026-04-12-label-copy-behavior.md       ← the why; dated filename
  glossary.md                                          ← optional
  agent-instructions.md                                ← runtime contract for agents
  schemas/                                             ← JSON schemas for validation
  indexes/
    knowledge.sqlite                                   ← gitignored
```

## File format

Markdown with YAML frontmatter. One format, everywhere.

### Concept — `concepts/label.md`

```markdown
---
id: concept.label
title: Label
status: active
tags: [labels, items]
related: [concept.item, concept.maturity]
anchors:
  - glob: src/labels/**
  - symbol: LabelService
reviewed: 2026-04-01
---

# Label

A user-visible marker attached to items: `{ _id, title, color }`.

Labels behave very differently depending on the maturity of the item they
attach to (see [[concept.maturity]]).
```

### Rules — `rules/labels.md`

Each `##` heading is a rule. The heading slug is its ID:
`rules.labels.<heading-slug>`.

```markdown
---
concept: concept.label
---

# Label rules

## Personal labels are visible only to their creator

status: active
anchors:

- symbol: LabelService.visibleTo
- glob: src/labels/visibility.ts
  rationale: rationales/2023-08-personal-labels.md
  reviewed: 2026-04-01

Regardless of item maturity, personal labels never leak to other users.

## Personal labels are dropped on cross-user copy

status: active
anchors:

- symbol: copyDocument
- symbol: Item.duplicate
  rationale: rationales/2026-04-12-label-copy-behavior.md
  reviewed: 2026-04-12

When user A duplicates an item owned by user B, personal labels are dropped.
Shared labels follow.
```

### Rationale — `rationales/2026-04-12-label-copy-behavior.md`

Edit freely. Git carries the history. If intent changes substantively,
write a new dated rationale and update the rule's `rationale:` pointer —
the old file stays for context.

```markdown
---
id: rationale.2026-04-12-label-copy-behavior
date: 2026-04-12
status: active
---

# Label copy behavior across users

## Context

Users were complaining that copying a colleague's item exposed the colleague's
personal organization labels.

## Rationale

Personal labels are private organizational tools. Treating them as part of
the item's data leaks user A's mental model to user B.

## Consequence

On copy across users: shared labels follow, personal labels drop.
Implemented in `copyDocument`.
```

### Cross-references

- `[[concept.label]]` — wiki-style link, indexed into the `links` table.
- `related:` / `concept:` / `rationale:` in frontmatter — typed links.

Both feed the same graph view; pick whichever reads better in prose.

## Anchors

Anchors connect knowledge to code. Three forms, in order of preference:

| Form      | Example                          | When                           |
| --------- | -------------------------------- | ------------------------------ |
| `symbol:` | `symbol: LabelService.visibleTo` | Rule tied to specific behavior |
| `path:`   | `path: src/labels/visibility.ts` | Rule tied to one file          |
| `glob:`   | `glob: src/labels/**`            | Cross-cutting concern          |

Symbol resolution uses **tree-sitter** at index time (no LSP needed,
language-agnostic). Resolved anchors record file path + file hash.

Resolution outcomes:

- `resolved` — symbol/path/glob found.
- `broken-anchor` — symbol no longer exists, or path/glob matches nothing.

## Drift & staleness

Two independent dimensions per rule:

1. **Anchor health** — does the code still exist?
   - `resolved` → fine.
   - `broken-anchor` → strong signal, surfaced loudly.

2. **Freshness** — has the anchored code changed since the last review?
   - File-level hash. Any anchored file changes → rule becomes `stale`.
   - Stale ≠ wrong. It means _re-confirm intent_.

### Re-confirming a rule

Two mechanisms in v1; we'll see which sticks:

- **(A)** Edit the rule's frontmatter `reviewed: <today>` directly.
  Git-native, grep-friendly.
- **(B)** Run `know review <rule-id>` — CLI stamps the date for you.

Both produce the same DB state.

## CLI

| Command                 | Purpose                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `know init`             | Scaffold `.knowledge/`, install `AGENTS.md` block + `agent-instructions.md` |
| `know index`            | Parse files, resolve anchors, write SQLite                                  |
| `know sync`             | Incremental re-index based on file hashes                                   |
| `know status`           | Counts: active / stale / broken-anchor rules                                |
| `know context <path>`   | **The 95% command** — rules, concepts, rationales touching path             |
| `know query "<sql>"`    | Read-only SQL access                                                        |
| `know query --schema`   | Print schema + example queries                                              |
| `know review <rule-id>` | Stamp `reviewed:` in rule frontmatter                                       |
| `know validate`         | Schema-check files; report dangling refs                                    |

## `know context <path>`

Given a path the agent or human is about to edit, returns everything
relevant:

```bash
know context src/labels/visibility.ts
```

Output (Markdown, agent-friendly):

```markdown
# Knowledge for src/labels/visibility.ts

## Active rules (2)

### rules.labels.personal-visible-only-to-owner [active, reviewed 2026-04-01]

Regardless of item maturity, personal labels never leak to other users.
→ rationale: rationales/2023-08-personal-labels.md

### rules.labels.copy-personal-not-followed [stale: src/labels/visibility.ts changed 2026-04-20]

…

## Connected concepts

- concept.label — Labels behave differently per item maturity.
- concept.maturity — see related rules in rules/item-maturity.md

## Recent rationales touching this code

- 2026-04-12 Label copy behavior across users
- 2023-08 Personal labels privacy

## Broken anchors touching this file

(none)
```

Always returns:

1. Active rules whose anchors match the path.
2. Stale rules (with reason).
3. Concepts referenced by those rules.
4. Rationales linked from those rules, newest first.
5. Broken anchors touching the path (if any).

Path-only granularity in v1. `--symbol` is deferred.

## `know query` — read-only SQL

```bash
know query "SELECT id, statement FROM rules WHERE status = 'active'"
know query --schema
```

- Connection opens SQLite with `mode=ro`. No write paths exist.
- Custom SQL helpers registered at connection time:
  - `anchors_match(path)` — owner IDs whose anchors match the path.
  - `concept_neighbors(id)` — linked concept IDs.

LLMs write SQL fluently — no new protocol required.

## Agent integration

No MCP, no extension. Two files do the work:

- **`AGENTS.md`** — managed block points agents at
  `.knowledge/agent-instructions.md`.
- **`.knowledge/agent-instructions.md`** — the runtime contract:

```markdown
# Working in this repository

Domain knowledge lives in `.knowledge/`. Before editing any file, run:

    know context <path>

Treat returned **active rules** as constraints on your change.

If a rule is **stale**, read its linked rationale. Either:

- confirm the rule still holds — update `reviewed:` (or run `know review <id>`)
- propose a rule change in the same PR

If a rule has a **broken-anchor**, flag it; the code it referenced no longer
exists.

For broader queries:

    know query "<sql>"
    know query --schema

Never write to the SQLite file. Edit `.knowledge/*.md` only.
```

This file is the most important file in the system. Iterate on it more than
on any code.

## Workflow

```
edit .knowledge/*.md   →   know index   →   git commit
                                  ↑
                  agent runs `know context <path>` before editing code
```

## Schema (read model)

```sql
CREATE TABLE items (
  id TEXT PRIMARY KEY,         -- concept.label, rules.labels.<slug>, rationale.<date>-<slug>
  kind TEXT NOT NULL,          -- concept | rule | rationale
  title TEXT,
  path TEXT NOT NULL,
  body TEXT NOT NULL,
  frontmatter_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  statement TEXT NOT NULL,
  status TEXT NOT NULL,        -- active | stale | broken-anchor | deprecated
  rationale_id TEXT,
  reviewed_at TEXT
);

CREATE TABLE rationales (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  decision_date TEXT
);

CREATE TABLE anchors (
  id TEXT PRIMARY KEY,
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
  relation TEXT                -- wiki | related | concept | rationale
);

CREATE TABLE embeddings (
  ref_id TEXT PRIMARY KEY,
  kind TEXT,
  vector BLOB,
  content_hash TEXT
);
```

## Indexer flow

```
.knowledge/*.md → parse frontmatter + sections
                → resolve anchors (tree-sitter, glob, path)
                → hash anchored files
                → compare against last index → compute status
                → write items, rules, rationales, anchors, links
                → embeddings (optional, for semantic recall)
```

Idempotent. Hash-based incremental re-index. The database is fully
reproducible from files at any time and is **never** committed to Git.

---

# Part 2 — Design

The pragmatic part above tells you _what_ the system does. This part records
_why_ — the constraints, the principles, and the trade-offs we picked.

## Problem framing

Codebases accumulate rules that aren't in the code: business decisions,
domain quirks, "this is why we did it like this" reasoning, RBAC subtleties,
edge cases everyone with tenure remembers. When that knowledge lives only in
people's heads (or scattered across Confluence, Slack, meeting notes), three
failure modes recur:

1. New developers and AI agents make confident changes that violate
   undocumented invariants.
2. A person leaves and their knowledge leaves with them.
3. Domain experts become bottlenecks; reviews get heavier; velocity drops.

`know` exists to make that knowledge **explicit, versioned, and surfaced
exactly when it matters** — at the moment of change.

## First principles

What is this system, stripped down? **Propositions about a codebase that
aren't in the codebase**, with two non-trivial obligations:

1. **Findability** — when I'm about to touch X, I learn what's known about X.
2. **Faithfulness** — when X changes, the propositions about X are
   re-examined.

Everything downstream — files, SQLite, anchors, drift — is a means to those
two ends.

### Forcing constraints

| Constraint                        | Implication                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Must survive a person leaving     | No tool lock-in; plain text + Git                                              |
| Must survive a refactor           | Anchors must be **semantic**, not just line numbers                            |
| Must survive a rename             | Anchors that move with the code, or are detected as broken                     |
| Must be cheap to write            | Authoring overhead kills adoption — single file, frontmatter, no IDs to invent |
| Must be cheap to read for agents  | Small, focused snippets > one giant doc                                        |
| Must distinguish stale from wrong | A rule from 2022 must be visibly aging, not silently lying                     |
| Truth lives in code, not docs     | Code is canonical for behavior; knowledge is canonical for _intent_            |

## Principles

1. **Files are the source of truth.** Markdown + YAML in Git. Editable by
   humans without tooling.
2. **SQLite is a disposable read model.** Only the indexer writes to it.
   Rebuildable from files at any time.
3. **Knowledge is commentary; code is canonical for behavior.** Knowledge is
   canonical for _intent_.
4. **Pre-change awareness beats post-change validation.** The most valuable
   moment is right before an agent or human touches code.
5. **Plain SQL is the API.** No MCP, no protocol, no server. Read-only DB
   open, schema documented for agents.
6. **Boring beats clever.** Anchors are paths, globs, and symbol names —
   nothing more.

## First-class citizens

Only four primitives are load-bearing. The test: remove any one, and the
system fails on a real example.

| Primitive     | What it gives                                                     |
| ------------- | ----------------------------------------------------------------- |
| **Concept**   | Vocabulary. The nouns the business cares about.                   |
| **Rule**      | Constraint. Atomic, reviewable, has a status.                     |
| **Rationale** | History. The _why_, whether or not an explicit decision was made. |
| **Anchor**    | The connection to code. The hardest primitive.                    |

### What's deliberately _not_ a first-class citizen

- **The graph.** Emergent — `[[wikilinks]]` plus typed frontmatter refs are
  enough. A "graph view" is a query, not an architecture.
- **The database.** Read model. Never mentioned in the authoring loop.
- **Folders/categories.** Pre-emptive taxonomies always fail. Tags + search
  beat folders.
- **Human-invented IDs.** Derived from filename + heading slug.

## Key design decisions

### Why "rationale" over "decision" or "motivation"

- _Decision_ implies an explicit choice was made — often false.
- _Motivation_ leans personal/subjective ("why I did it").
- _Rationale_ covers both explicit choices and "this is why it's this way"
  reasoning without forcing a fiction.

ADRs (Architecture Decision Records) inspired the format, but we don't
require an explicit decision to have happened.

### Why one file per concept area, not one file per rule

Authoring overhead kills adoption. A human reading about labels should open
**one file** — `rules/labels.md` — and see all the label rules together,
each as a `##` section. Atomic per-rule files would be more "structured"
and far less pleasant. The indexer reconstitutes the atoms.

### Why we don't make rationales append-only

Earlier draft had append-only rationales (ADR-style). We dropped it: Git
already gives us history, and append-only makes editing typos a ceremony.
If intent genuinely changes, write a new dated rationale and re-point the
rule.

### Why tree-sitter, not LSP

- Language-agnostic, no project context required.
- Fast, embeddable, no running server.
- Accuracy is sufficient for "find this symbol's defining file" — which is
  all we need. We're not doing call-graph analysis.

LSP would be more accurate but adds significant operational complexity for
marginal gain. We can layer LSP later if a real need appears.

### Why file-hash, not symbol-body hash

- Symbol-body hashing requires per-language extraction logic and produces
  noise when imports, helpers, or signatures move.
- File-hash is dumb, fast, language-agnostic, and good enough.
- Side benefit: when a rule's anchored file is huge and churns constantly,
  the staleness signal becomes noisy — which is the system telling you to
  **extract the rule-relevant code into its own file**. A gentle
  modularity nudge.

### Why "stale" never means "wrong"

A file changing doesn't mean the rule is wrong. It means _re-confirm
intent_. The two transitions:

```
active → stale (anchored file changed)
stale  → active (reviewer confirms)  OR  → deprecated (rule no longer holds)
```

This separation matters: it lets the system flag risk without crying wolf.

### Why anchor health and freshness are separate signals

- A rule with a `broken-anchor` is loud — the code it points at no longer
  exists, so something is definitely off.
- A rule that's `stale` is quiet — the code still exists, it just changed.

Conflating the two would produce one less-useful signal.

### Why no in-code anchor comments in v1

- They're the most refactor-robust anchor (they physically travel with the
  code), but they touch the code itself, which raises the cost of authoring
  a rule.
- v1 keeps all knowledge out of the source tree. We can add `// know:rule(...)`
  later as an opt-in for high-stakes invariants, without changing the file
  format.

### Why no executable rules in v1

A rule linked to a passing test is the gold standard — CI literally proves
it holds. But:

- It only works for mechanizable rules.
- It adds a new anchor type and a test-runner integration.
- v1 should prove the _awareness_ loop first; mechanization comes after.

### Why pre-change awareness, not CI / PR bots

We considered the full surface (pre-commit hooks, CI checks, PR comment
bots, IDE CodeLens). The single highest-leverage point is **before** the
edit happens:

- A bug prevented is a bug not written, reviewed, or shipped.
- For AI agents, the right rule in the prompt is worth a hundred
  post-hoc warnings.
- A PR bot can be added later in a few hundred lines once the indexer
  exists. The data model doesn't change.

So v1 ships exactly one awareness mechanism: `know context <path>`,
invoked by humans manually and by agents per `agent-instructions.md`.

### Why SQL, not MCP

- LLMs write SQL fluently, with zero new tooling.
- No protocol, no server, no auth, no lifecycle.
- Read-only is enforced at the driver (`mode=ro`), not via SQL parsing.
- A few registered helper functions (`anchors_match`, `concept_neighbors`)
  hide the join complexity so common queries are one-liners.

MCP can be layered on later if a real integration demands it. The data
model doesn't change.

### Why `know context` returns more than rules

A rule without its rationale is half-useful: an agent given the constraint
but not the reasoning can't tell whether a proposed change is a violation
or a legitimate update of intent. So `know context` always returns:

- Active rules (the constraints).
- Stale rules with their reason (the things to re-confirm).
- Connected concepts (the vocabulary).
- Recent rationales (the why).
- Broken anchors touching the path (the loud signal).

This is the single most important UX decision in the system.

## Prior art we borrowed from

| System                              | What we stole                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| **ADRs**                            | Dated rationale files; the "why" as a first-class artifact                      |
| **Docs-as-code / Diátaxis**         | Markdown in repo, reviewed via PR, separation of concept vs reference           |
| **`CODEOWNERS`**                    | Tiny, glob-based, parsed by tooling, lives in repo. Boring and effective        |
| **Sourcegraph / LSP / tree-sitter** | Symbol references survive renames                                               |
| **Cursor/Copilot rules, AGENTS.md** | Agents will read short, scoped instruction files                                |
| **Obsidian / Logseq**               | `[[wikilinks]]` are the lightest possible graph syntax                          |
| **Pact / property-based tests**     | The deepest idea — an executable rule never silently rots (deferred to post-v1) |
| **Semgrep / CodeQL**                | Pattern-as-data invariants colocated with intent (deferred)                     |

## Out of scope for v1 (intentional)

- PR bot / GitHub Action / CI checks
- IDE extension / CodeLens
- In-code anchor comments
- Executable rule anchors (`test:`)
- Symbol-level `know context --symbol`
- Web UI
- Multi-repo federation

Each is straightforward to add once v1 is dogfooded. None are required to
prevent the bulk of "I didn't know that rule existed" mistakes — that's
done by `know context` + `agent-instructions.md`.

## Open questions

1. **Reviewed semantics** — does (A) frontmatter `reviewed:` date or
   (B) `know review` win in practice? Ship both, decide after one month
   of real use.
2. **`know context` output format** — Markdown (default) vs. JSON via
   `--json`. Probably ship both.
3. **Embeddings** — useful for "find rules semantically related to this PR
   description"? Cheap to add behind a feature flag; defer until a real
   query needs it.
4. **Naming** — `rationales/` vs. `motivations/`. Decide after writing
   5–10 real ones and seeing which word fits the prose better.
5. **Modularity nudge thresholds** — N changes in M weeks. Pick numbers
   after observing real churn patterns.

## Summary

```
Code        → what the system does
Knowledge   → why it does it
SQLite DB   → how it is queried
know context → what gets read at the moment of change
```

Result:

- shared understanding across developers
- structured knowledge for AI agents
- traceable, versioned domain logic
- no external infrastructure required
