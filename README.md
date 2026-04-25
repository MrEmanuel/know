# tsdown-starter

A starter for creating a TypeScript package.

## Development

- Install dependencies:

```bash
npm install
```

- Run the unit tests:

```bash
npm run test
```

- Build the library:

```bash
npm run build
```

# Knowledge System (Git-Native + SQLite)

This repository includes a **Git-native knowledge layer** that captures domain knowledge, rules, and decisions alongside the codebase, and compiles it into a **queryable SQLite database** for fast access by developers and AI agents.

---

# Overview

```
.knowledge files (source of truth)
        ↓
Indexer (automatic / manual)
        ↓
SQLite database (derived, local)
        ↓
SQL / UI / agent queries
```

- **Files** = canonical, version-controlled knowledge
- **SQLite** = fast, disposable query layer
- **Git** = history, review, collaboration

---

# Core Principle

```
Files are for writing.
SQLite is for reading.
The indexer is the only writer to SQLite.
Git as version control
```

This system does **not** introduce a custom authoring interface.

- Knowledge is authored directly in Markdown/YAML files
- SQLite is a generated read model
- The indexer compiles files into a queryable database

---

# Folder Structure

```
.knowledge/
  concepts/     # Domain knowledge
  rules/        # Business rules
  decisions/    # Architecture design decisions
  evidence/     # Links to code, tests, issues
  sources/      # Raw ingested material (optional)

  indexes/      # Generated (gitignored)
    knowledge.sqlite

  schemas/      # JSON schemas for validation
```

---

# Example Files

## Concept

```
.knowledge/concepts/labels.md
```

```markdown
---
id: concept.labels
title: Labels
status: active
tags:
  - labels
  - documents
---

# Labels

Labels are user-visible markers attached to documents and items.

## Rules

- Personal labels are visible only to their creator.
- Shared labels are visible to all users in a workspace.

## Edge cases

### Document copying

Labels may follow depending on ownership and workspace.
```

---

## Rules

```
.knowledge/rules/labels.yml
```

```yaml
rules:
  - id: labels.personal.visible-only-to-owner
    statement: Personal labels are visible only to the user who created them.
    status: active
    applies_to: concept.labels
    evidence:
      - code:src/labels/visibility.ts
```

---

## Decision

```
.knowledge/decisions/2026-04-25-label-copy.md
```

```markdown
# Label copy behavior

## Decision

Personal labels do not follow when another user copies a document.

## Rationale

Personal labels represent private organization.
```

---

# SQLite Schema

The indexer compiles files into a local SQLite database:

```sql
CREATE TABLE knowledge_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT,
  path TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  content_hash TEXT NOT NULL
);

CREATE TABLE knowledge_sections (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  heading TEXT,
  level INTEGER,
  body TEXT
);

CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  statement TEXT NOT NULL,
  status TEXT,
  applies_to TEXT,
  path TEXT NOT NULL,
  metadata_json TEXT
);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  title TEXT,
  decision_date TEXT,
  path TEXT NOT NULL,
  body TEXT
);

CREATE TABLE evidence_links (
  id TEXT PRIMARY KEY,
  from_id TEXT,
  to_ref TEXT,
  relation TEXT,
  confidence TEXT
);

CREATE TABLE embedding_records (
  id TEXT PRIMARY KEY,
  kind TEXT,
  ref_id TEXT,
  text TEXT,
  embedding BLOB,
  content_hash TEXT
);
```

---

# Indexing

Run:

```bash
know index
```

This:

1. Parses all `.knowledge/` files
2. Validates schema
3. Extracts sections and rules
4. Computes content hashes
5. Generates embeddings
6. Writes to:

```
.knowledge/indexes/knowledge.sqlite
```

The database is **not committed to Git**.

---

# Synchronization

```bash
know sync
```

- Detects changed files via hash
- Re-indexes only modified entries
- Removes deleted content

Check status:

```bash
know status
```

---

# Querying (Primary Interface)

## Direct SQL

```sql
SELECT *
FROM rules
WHERE applies_to = 'concept.labels'
AND status = 'active';
```

## Full-text search

```sql
SELECT *
FROM knowledge_items
WHERE body MATCH 'labels AND copying';
```

## Vector / semantic search

```
"How do labels behave when duplicating documents?"
```

Matches:

- concept sections
- rules
- decisions

---

# Authoring (Primary Interface)

There is **no CLI for writing knowledge**.

To add or update knowledge:

```text
1. Edit Markdown/YAML files in .knowledge/
2. Run indexer (or let it run automatically)
3. Commit changes to Git
```

Example:

```bash
edit .knowledge/concepts/labels.md
know validate
know index
git commit
```

---

# Agent Interaction Model

## Read

Agents query SQLite:

```sql
SELECT * FROM rules WHERE applies_to = 'concept.labels';
```

## Write

Agents propose file changes:

```text
.knowledge/concepts/labels.md
.knowledge/rules/labels.yml
```

Then:

```text
Indexer updates SQLite automatically
```

Agents must **never write directly to the database**.

---

# Query Flow

```
User / agent query
  ↓
Vector search (semantic)
  ↓
SQL filtering (rules, metadata)
  ↓
Evidence lookup (code/tests)
  ↓
Final result
```

---

# Workflow

## Add knowledge

```
edit files → index → commit
```

## Update knowledge

```
edit files → validate → index → commit
```

## Query knowledge

```
SQL / UI / agent queries
```

---

# Design Principles

## 1. Files are the source of truth

```
Git = database
```

## 2. SQLite is a read model

```
SQLite = compiled query layer
```

## 3. Index is disposable

```
Rebuild anytime from files
```

## 4. Everything is traceable

```
knowledge → rule → evidence → code
```

## 5. Safe for AI

- read via SQLite
- write via Git diffs
- validated before commit

---

# Summary

```
Code        → what the system does
Knowledge   → why it does it
SQLite DB   → how it is queried
```

Result:

- shared understanding across developers
- structured knowledge for AI agents
- traceable, versioned domain logic
- no external infrastructure required
