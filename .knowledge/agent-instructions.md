# know agent instructions

## Purpose

`know` captures domain rules, anchors, and rationale alongside the codebase.
Knowledge lives in version-controlled Markdown files in `.knowledge/`; a
generated SQLite database in `.knowledge/indexes/` makes it queryable.

## Before editing any file

Run:

```bash
yarn know context <path>
```

If this repository does not use Yarn, use the equivalent package-manager
invocation, such as `npx know context <path>` or
`pnpm know context <path>`.

This returns:

- **Active rules** whose anchors match the path - treat these as constraints.
- **Stale rules** - anchored code changed since last review. Read the rationale and either confirm by updating `reviewed:` or propose a rule change.
- **Connected concepts** - optional vocabulary reached through matching rules.
- **Broken anchors** - code a rule pointed at no longer exists. Flag it.

## Broader queries

```bash
yarn know query "<sql>"     # read-only SQL against the index
yarn know query --schema    # print schema + example queries
```

## Knowledge structure

- `.knowledge/rules/` - source of truth; each `##` section is a rule with anchors and rationale.
- `.knowledge/concepts/` - optional domain vocabulary reached from rule metadata.

## Rules for agents

- Always run `yarn know context <path>` before editing a file.
- Treat active rules as constraints on your change.
- Never write to `.knowledge/indexes/knowledge.sqlite`.
- Never edit generated files under `.knowledge/indexes/`.
- To add or update knowledge, edit `.knowledge/*.md` files only.
- After editing knowledge files, run `yarn know index` if available.
