---
id: concept.knowledge-system
title: Knowledge System
status: active
tags:
  - git-native
  - sqlite
  - agents
---

# Knowledge System

The knowledge system captures repo domain knowledge, rules, and decisions alongside code. The version-controlled `.knowledge/` file tree is the source of truth, and SQLite is a derived local query layer for developers and AI agents.

## Boundaries

- Markdown and YAML files are the authoring surface.
- SQLite exists for queries and can be rebuilt from source files.
- Git provides history, review, and collaboration.
- Generated indexes are local artifacts and are not committed.

## Primary Workflows

- Add knowledge by editing `.knowledge/` files, indexing, and committing the files.
- Update knowledge by editing `.knowledge/` files, validating, indexing, and committing the files.
- Query knowledge through SQL, UI, or agent query interfaces backed by the read model.
