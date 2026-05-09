# Know - Connect business rules to code

## Why Know?

Know solves the tribal knowledge problem.
"Tribal knowledge is knowledge that is not documented, and only exists in the minds of a few individuals. This creates a risk of knowledge loss if those individuals leave the organization, and makes it difficult for new team members to learn and understand the system."

## Know in a nutshell

Define rules.
Link it to code.
Get notified of the relevant rules when editing code.

## For AI agents

An AI-agent is only as good as the context it's given. Know provides AI-agents with precisely the context they need when editing code. No need to bloat your AI's context with business rules. The Know system provides the AI-agent with the relevant rules to make informed decisions then and there, when editing the code.

## For developers

The know system provides developers with the context they need when editing code. No need to keep business rules in your head, or search for them in documentation. The know system will inform you of the relevant rules when editing the code, ensuring that you always have the context you need to make informed decisions.

## For managers

The Know system provides a way to easily oversee and browse what rules exist, and if they are up to date and followed. It provides a surface for managers and developers to work together, ensuring that rules and constraints of the system are relevant, up to date, and followed. Because the Know system connects rules to code, managers can be confident that the rules are being followed.

## For business owners

If the reliability and consistency of your IT-system is core to your business, you want a tool that provide anyone working on the system with the context they need to make informed decisions. The Know system ensure that what made the system successful in the first place, remains intact as the system evolves.

Don't rely on a single person's expert knowledge of the system. Systemize the knowledge, and make it available to anyone working on the system. This is what Know does.

> **Goal:** prevent 80-99% of "I didn't know that rule existed" mistakes by
> surfacing relevant rules before a change is made.

A common information structure for teams today is:
Confluence -> Jira -> Application logic

Business rules, if documented at all, are stuck in confluence pages. No connection to code. No signal when they are violated.

Most teams rely on implicit knowledge, often domain specific and carried by key individuals. This creates lock-in where the project's long-term success, and ulitimatly the business's success, depends on those individuals not leaving.

It's also a huge blind spot for AI agents, which have no way to access that knowledge when making changes to the codebase. They rely in humans to explicitly communicate the rules, every time, or document them in comments or markdown files that might never be read.

Know solves many of these problems.
Know provide users, AI-agents and managers a system that is easy to browse, edit and maintain, and that surfaces relevant rules at the right time, when code is being edited. It gives developers and AI-agents the context they need to make informed decisions, and it gives managers confidence that the rules are being followed, even as the code evolves.

For more indepth information on the system design, tech stack, file structure, syntax, and primitives, please refer to the respective documents in the docs directory.
Ideas for possible future development are collected in `docs/futureIdeas.md`.

# Part 2 - Design

## Documentation Philosophy

These documents describe what Know is, what problems it solves, and the system contracts that should stay true as the implementation evolves.

They are not intended to replace implementation design in code. Exact data structures, internal algorithms, crate-level module boundaries, and low-level error handling belong in the implementation unless they define externally visible behavior or durable file formats.

The documentation should stay close to the ground truth primitives: rules, links, code targets, verification, and context. When a feature requires a large explanation, that is a signal to restate the problem and ask whether the feature belongs in the baseline system.

## Problem Framing

"Tribal knowledge is knowledge that is not documented, and only exists in the minds of a few individuals. This creates a risk of knowledge loss if those individuals leave the organization, and makes it difficult for new team members to learn and understand the system."

Codebases accumulate rules that are not in the code: business decisions,
domain quirks, RBAC subtleties, edge cases, and "this is why it works this
way"-reasoning. When that knowledge lives only in people's heads or scattered
systems, people and agents make confident changes that violate invariants they
never saw.

Know exists to make those rules explicit, versioned, and surfaced exactly
when they matter: before code is changed.

## First Principles

Stripped down, Know is about **propositions about code that need to be
re-examined when that code changes**.

Two obligations follow:

1. **Findability** - when I am about to touch X, I learn which rules touch X.
2. **Faithfulness** - when X changes, those rules are visibly unverified until
   someone re-confirms them.

Everything else is a means to those ends.

## Forcing Constraints

| Constraint                             | Implication                                                       |
| -------------------------------------- | ----------------------------------------------------------------- |
| Must survive a person leaving          | Plain text + Git                                                  |
| Must survive a refactor                | Links must be semantic where possible                             |
| Must survive a rename                  | Links should move with symbols, or break loudly                   |
| Must be cheap to write                 | One rules file per area, no opaque IDs to invent                  |
| Must be cheap to read for agents       | Small focused output from `know context`                          |
| Must distinguish unverified from wrong | A rule from 2022 must visibly age, not silently lie               |
| Truth lives in code, not docs          | Code is canonical for behavior; knowledge is canonical for intent |

## Principles

1. **Rules are the center.** A rule owns its links, status, rationale, and
   review date.
2. **Files are the source of truth.** TOML in Git.
3. **Git is used for versioning, not the system itself.** The system only tracks the current state of rules and links, and relies on git for historical changes and versioning.
4. **SQLite is a disposable read model.** Only the indexer writes to it.
5. **Knowledge is commentary; code is canonical for behavior.** Knowledge is canonical for intent.
6. **Pre-change awareness beats post-change validation.**
7. **Stable slugs beat opaque IDs.** Rules and concepts have required human-readable IDs that can be suggested by the CLI or TUI.
8. **Boring beats clever.** Links are paths, globs, and symbol names.

## First-Class Citizens

Only two primitives are load-bearing:

| Primitive | What it gives                      |
| --------- | ---------------------------------- |
| **Rule**  | Description, rationale and context |
| **Link**  | A verified rule-code relationship  |

Other primities are helpful but optional:
| Primitive | What it gives |
| ---------- | ---------------------------------- |
| **Concept** | A way to group rules by domain noun, and give agents a shared vocabulary. |
| **Tag** | A way to group rules and concepts by any arbitrary label. Useful for organization, discoverability, querying and semantic search |

## Key Design Decisions

### Why Inline Rationale

Most rules have a 1:1 relationship with their rationale. Splitting that into a
separate file makes common authoring slower and increases the chance that the
why is missing, stale, or not read. Inline rationale keeps the constraint and
the reason together in the `know context` output. Rationale is required for
every rule.

### Why Inline Links

A link is the relationship between one rule and one code target. That
relationship owns its own verification status, because the same code can be
verified for one rule and unverified for another. Keeping links inline under
rules makes the source file match that ownership model, while the parser and
SQLite read model can still treat links as first-class records internally.
Links do not have source-defined IDs; their identity is scoped to the owning
rule.

### Why Optional Concepts

Concepts are helpful when a domain noun appears across many rules. They remove
repetition and give agents vocabulary. But the system still works without
them, so they should not be treated as required structure.

### Why One File Per Concept Area

Authoring overhead kills adoption. A human reading about labels should open
`rules/labels.toml` and see all label rules together as `[[rules]]` entries.
The indexer reconstitutes those entries and their inline links into rule and
link rows.

### Why Tree-Sitter, Not LSP

- Language-aware symbol discovery without a running server.
- Fast and embeddable.
- Accurate enough for "find this symbol's defining file."

### Why Stale Never Means Wrong

A file changing does not mean the rule is invalid. It means the rule must be
re-confirmed:

```txt
verified → unverified (linked file changed)
unverified → verified (reviewer confirms)
```

### Why Verification Is Not Mandatory Or Prescribed

The highest-leverage moment for Know is surfacing rules before code changes. Verification (re-confirmation that a rule still applies) should not create burden for developers. Teams should be able to choose when and how re-verification happens—through tests, code review, pre-commit checks, AI agents, or on-demand audits. Know _detects_ when code changes and marks rules unverified; it does not mandate the verification workflow. This flexibility allows teams to integrate Know into existing processes without adding friction.

Unverified rules are clearly visible in reports and `know list`, making them visible debt without creating panic. A developer editing a file multiple times should not be bothered by Know warnings; nudges in reports and pre-change context are the right level of signal.

### Why Link Health And Freshness Are Separate

- `broken` link is loud: the code a rule points at no longer exists.
- `unverified` is quieter: the code exists, but changed after review.

Conflating those signals would make both less useful.

### Why Pre-Change Awareness, Not CI Bots First

The highest leverage moment is before the edit. For AI agents, the right rule
in prompt context is more valuable than a post-hoc warning after code has
already been changed.

### Why `know context` Starts From Rules

This is the main UX rule: a path should return rules touching that path, and
only then supporting context reached through those rules. Directly linked concepts are not enough to trigger output. This keeps `know context` focused on
the constraints that can be broken by the pending change.

### Why Unlinked Rules Are Visible in Reports But Not in Context

Unlinked rules are legitimate temporary work-in-progress—a team has documented a rule but hasn't yet mapped it to code. Unlinked rules should:

- Appear in `know list`, reports, and overviews (so the team sees them as implicit todos)
- NOT appear in `know context` when querying specific code (they don't apply yet)

This surfaces unlinked rules as work to do, without polluting context at the moment of editing code.

### What Know Is Not: Scope Boundary

Know connects _specific rules to specific code_. It is not a general system rules or principles repository.

**Know is for:** "When editing this billing service, remember that fractional cents must round down per GAAP rules."

**Know is not for:** "Our company believes in customer-first design" or "We follow SOLID principles" or general architectural philosophies.

If a rule applies to the entire system (not tied to specific code), it belongs in the repository root—README.md, ARCHITECTURE.md, AGENTS.md, or similar. Know is purposefully scoped to _link-bearing rules_, making it a targeted tool for preventing "I didn't know that rule existed" mistakes in the code being edited. This scope boundary prevents Know from becoming a dumping ground and forces teams to distinguish between general principles (which belong in repo docs) and code-specific constraints (which belong in Know).

### Verification: Flexible, Non-Burdensome, Multi-Party

When code changes, linked rules become `unverified`. **Know does not mandate how or when re-verification happens.** It can occur through multiple pathways:

- **Automated tests**: Executable rules linked to test suites that pass/fail verify the rule
- **Pre-commit**: Developer runs `know verify` locally before committing
- **Code review**: Human reviewer or bot confirms the rule during PR review
- **AI agents**: Agents with appropriate permissions analyze and verify rules in context
- **On-demand**: Teams run `know check` or report generation to identify and batch-verify stale rules

Know surfaces which rules are unverified (visible but not alarming), allowing teams to choose workflows that fit their process. **The system should nudge, not panic**—unverified rules are clear in reports and context, but not treated as errors that block work.

**AI Agent Verification Gate**: Teams should be able to configure Know to disallow AI agent verification of rules, keeping verification strictly human-controlled if desired. This respects teams that want human judgment on all rule confirmations.

**Multi-Party Verification Workflows**: Know's verification model needs deeper thinking across different stakeholder perspectives:

- **Developers and AI agents** (first priority): Verification should be lightweight, integrated into existing workflows (code review, tests), not add burden
- **Managers and project leaders** (secondary priority): Need visibility into rule health, stale rules, and coverage across the codebase
- **Product owners** (secondary priority): Need to understand which rules are actually enforced vs. aspirational

The baseline system focuses on developer and agent workflows; multi-party verification ceremonies are important design questions for v1+ maturity.

## Prior Art

| System                          | Borrowed idea                               |
| ------------------------------- | ------------------------------------------- |
| ADRs                            | Capture the why, but inline by default here |
| Docs-as-code                    | Markdown in repo, reviewed via PR           |
| CODEOWNERS                      | Tiny, glob-based, repo-native metadata      |
| Sourcegraph / LSP / tree-sitter | Symbol references survive simple moves      |
| Cursor/Copilot rules, AGENTS.md | Agents read short scoped instruction files  |
| Obsidian / Logseq               | Wiki links are lightweight graph syntax     |
| Pact / property-based tests     | Rules can be connected to executable checks |
