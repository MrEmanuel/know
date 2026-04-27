# `know` MVP plan

Living document. Updated as work progresses.

## Current model

Know is centered on rules and anchors:

- `.knowledge/rules/*.md` is the source of truth.
- Each `##` section is one rule.
- A rule owns its `status`, `reviewed`, `anchors`, statement, and inline
  `### Rationale`.
- `.knowledge/concepts/*.md` is optional vocabulary.
- SQLite is a generated read model.

## Decisions locked in

| Area               | Choice                                                               |
| ------------------ | -------------------------------------------------------------------- |
| SQLite library     | `node:sqlite` (built-in, Node 22+)                                   |
| Tree-sitter        | `web-tree-sitter` (WASM, no native build)                            |
| Symbol langs (MVP) | TypeScript + JavaScript                                              |
| Glob match         | Pre-expand at index time. `anchors_match()` queries resolved paths   |
| YAML               | `yaml` package                                                       |
| Markdown parser    | Hand-rolled minimal parser (frontmatter + `##` sections + wikilinks) |
| CLI output         | Markdown only                                                        |
| Review primary     | `know review <id>`; manual `reviewed:` edits also honored            |
| Test framework     | vitest                                                               |
| Example scenario   | `tests/fixtures/product-maturity/`                                   |

## Method

TDD. Each step:

1. Write failing tests covering the behavior promised by README/Design.
2. Implement until green.
3. `yarn test` must pass before moving on.
4. Update this doc's checklist + notes for the step.

## Steps

- [x] **1. File parser** - parse `.knowledge/**/*.md`; split rule files into
      `##` sections; extract per-rule metadata, statement, inline rationale,
      anchors, wikilinks, and typed concept links.
- [x] **2. Anchor resolver** - resolve `path:` / `glob:` by file lookup and
      `symbol:` by tree-sitter.
- [x] **3. SQLite writer** - schema for items / rules / anchors / links;
      compute `active`, `stale`, `broken-anchor`, and `deprecated`.
- [x] **4. `know index`** - orchestrate parser, resolver, and writer.
- [x] **5. `know context <path>`** - start from matching rule anchors, then
      return rule-linked rationale and concepts.
- [x] **6. `know query`** - read-only SQL.
- [x] **7. `know sync`** - re-index only when `.knowledge/` files changed.
- [x] **8. `know status`** - rule status counts plus optional concept count.
- [x] **9. `know review <id>`** - update one rule section's `reviewed:`.
- [x] **10. Example scenario** - product maturity fixture with inline rule
      rationale.

## Notes

### Parser

- File kind is inferred from top-level folder: `rules/` or `concepts/`.
- Rule id = `rules.<file-slug>.<heading-slug>`.
- Rule metadata runs from the `##` heading to the first blank line.
- Rule statement runs until `### Rationale`.
- Rule rationale is inline text after `### Rationale`.
- Concept id comes from frontmatter `id:` or `concept.<filename>`.
- Links are emitted from `[[wikilinks]]`, `related`, and `concept`.

### Anchor resolver

- `path:` - stat + SHA-256 of file bytes.
- `glob:` - expanded to one row per matched file.
- `symbol:` - scans TS/JS files, pre-filters by text, then walks tree-sitter
  nodes for top-level declarations or `Class.method`.

### SQLite writer

- `writeIndex` rebuilds the generated DB inside one transaction.
- Rule status is computed from rule metadata and resolved anchors.
- Inline rationale is stored directly on the `rules` row.
- The old standalone rationales table has been removed.

### Context

- `know context <path>` starts from matching rule anchors only.
- Concepts are returned only when linked from those matching rules.
- Directly anchored concepts do not trigger context by themselves.
- Broken anchors are scoped to the same rules files as matching rules.

### Package invocation

This repo uses `yarn know ...` because the package binary is local to the
workspace. Installed projects should invoke Know through their package manager
unless they install the binary globally.

### Future validation

Add schema/config validation for knowledge files. Apple's Pkl is a candidate,
along with JSON Schema or CUE. The validation layer should protect rule
metadata without making Markdown authoring heavy.
