---
id: decision.git-native-knowledge-layer
title: Git-Native Knowledge Layer With SQLite Read Model
status: active
decision_date: 2026-04-25
tags:
  - git-native
  - sqlite
  - read-model
---

# Git-Native Knowledge Layer With SQLite Read Model

## Decision

Knowledge is stored as version-controlled files under `.knowledge/`. SQLite is a generated local read model, and the indexer is responsible for compiling source files into that database.

## Rationale

Files are easy for humans and agents to review, diff, and commit. SQLite provides fast query access without becoming the canonical store. Keeping the database disposable preserves Git as the durable collaboration and history mechanism.

## Consequences

- Generated index files stay out of version control.
- Knowledge edits happen through Markdown/YAML file changes.
- Indexing and validation become part of the knowledge update workflow.
