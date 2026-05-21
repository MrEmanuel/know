# Config syntax

Definitions and examples of the syntax used in knowledge files (`.toml` files under `.know/`) for rules and concepts.

Tags can be added to rules, inline links, and concepts for better organization, discoverability, semantic search, and context. They can be used for filtering and searching in the CLI and TUI.

Links are defined inline under rules. The source-of-truth relationship is the rule-code pair: a specific rule claims relevance to a specific code target. Each inline link owns its own verification state, even when multiple rules point to the same file, glob, or symbol.

Inline links do not have their own required IDs in source files. Their source-defined identity is scoped to the owning rule.

Know knowledge files use a strict schema. Unknown fields are validation errors so typos cannot silently change system meaning. Tags are the supported lightweight mechanism for classification, filtering, search, context, and project-specific grouping.

## Tags

Tags are free-form strings. They are trimmed for validation, must be non-empty after trimming, and must be no longer than 80 characters. Tags must not contain newlines or control characters. Spaces, punctuation, uppercase letters, Unicode, and natural-language phrases are allowed.

Tags are preserved as written and are not normalized to the rule and concept ID slug format.

Tags may be attached to rules, concepts, and inline links. Know uses them for filtering, grouping, semantic search, and context generation.

## IDs

Rule and concept IDs use lowercase ASCII kebab-case slugs, such as `customer-email-immutable` or `billing-invoice-total`.

IDs may contain lowercase letters, digits, and single hyphens between segments. They must not contain whitespace, uppercase letters, underscores, punctuation other than hyphen, leading hyphens, trailing hyphens, or repeated hyphens.

Rule IDs must be unique across all rules in the project. Concept IDs must be unique across all concepts in the project. Rule IDs and concept IDs may overlap because references are typed by context.

## Rules

Rules require `id`, `description`, and `rationale`. The ID is a stable human-readable slug, not an opaque generated identifier. CLI and TUI authoring flows should suggest a slug from the rule description, while hand-authored TOML may provide one directly.

Inline links are optional. A rule with no links is valid and is classified as `unlinked` until at least one link is added.

```toml
[[rules]]
id = "customer-email-immutable"
description = "Customer email addresses must not be changed after verification."
rationale = "Email is used as the durable identity key for billing and audit history."
concepts = ["customer-identity"]
tags = ["billing", "identity"]

[[rules.links]]
target = "src/customer/email.ts"
kind = "path" # path | glob | symbol
tags = ["identity"]

[[rules.links]]
target = "src/customer/**/*.ts"
kind = "glob"
exclude = ["src/customer/generated/**"]
include_ignored = false
```

## Inline links

An inline link belongs to exactly one rule. Within that rule, the same `kind` and `target` pair must not be repeated. Link definitions describe author intent only; they do not contain verification status, timestamps, or fingerprints.

Path, glob, and symbol targets in knowledge files use canonical repository-root-relative target forms. Generated verification entries use the same canonical target forms.

Path and glob targets use repository-root-relative paths with `/` separators. They must not be absolute paths, contain `..` segments, start with `./`, or use backslashes.

Path links target exactly one repository file. A directory is not a valid `path` target; use a `glob` link for directory or subtree coverage.

Symbol links use a file-scoped target form:

```txt
path/to/file.ext#Symbol.path
```

The path portion follows the same canonical path rules as path links. The symbol portion is resolved structurally with Tree-sitter where a supported grammar exists.

The symbol portion is a dotted symbol path made from named structural declarations, such as classes, structs, interfaces, traits, enums, functions, methods, and similar top-level or nested declarations. The baseline system does not support symbol links to arbitrary expressions, local variables, anonymous callbacks, or line numbers.

```toml
[[rules.links]]
target = "src/billing/invoice.ts#Invoice.calculateTotal"
kind = "symbol"
tags = ["entrypoint"]
```

Glob links resolve to repository files only. Directories are not included in the resolved target set.

Glob links respect repository ignore rules, such as `.gitignore`, by default. Ignored files are excluded from the resolved target set unless the link sets `include_ignored = true`. `include_ignored` defaults to `false` and is valid only on glob links.

Glob links may include `exclude` patterns. Exclusions are resolved from the repository root using the same deterministic matching rules as glob targets.

A glob link whose syntax is invalid is an invalid link definition. A syntactically valid glob that resolves to zero files is broken.

Path links may target ignored files when the file is named explicitly and exists.

## Link verification file

Approval data is stored in `.know/linkVerification.toml`. This file is generated by Know, committed to Git, and updated when a user verifies a rule-link-code relationship.

The file is machine-produced and deterministic. Know writes it in a stable order with normalized values, so repeated writes from the same verified state produce the same file content.

Approval entries store component fingerprints, not a persisted status label. The system derives current status by comparing the current rule, link, and target fingerprints against the stored approval entry.

Know can recompute the current fingerprints at any time, but it must not replace the approval fingerprints unless the user explicitly verifies the relationship. The file records the last user-approved fingerprint set, not merely the latest observed state.

```toml
version = 1

[[links]]
rule = "customer-email-immutable"
kind = "path"
target = "src/customer/email.ts"
rule_fingerprint = "sha256:..."
link_fingerprint = "sha256:..."
target_fingerprint = "sha256:..."

[[links]]
rule = "customer-email-immutable"
kind = "glob"
target = "src/customer/**/*.ts"
rule_fingerprint = "sha256:..."
link_fingerprint = "sha256:..."
target_fingerprint = "sha256:..."

[[links]]
rule = "customer-email-immutable"
kind = "symbol"
target = "src/billing/invoice.ts#Invoice.calculateTotal"
rule_fingerprint = "sha256:..."
link_fingerprint = "sha256:..."
target_fingerprint = "sha256:..."
```

For path links, `target_fingerprint` represents the resolved file's content fingerprint.

For glob links, `target_fingerprint` represents the sorted resolved target file set and each resolved file's content fingerprint. Directories are not included. If a new file starts matching the glob, an existing file stops matching, or a matched file changes, the target fingerprint changes.

For symbol links, `target_fingerprint` represents the resolved syntax node or symbol body fingerprint. Symbol resolution uses Tree-sitter where a supported grammar exists. Knowledge files and generated verification entries store symbol targets in canonical `path#symbol` form. Unsupported languages, parse failures, and unresolved symbols are broken targets.

## Link verification lockfile

Current derived link-verification state is stored in `.know/linkVerification.lock.toml`. This file is generated by Know, committed to Git, and updated by commands that recompute the current analysis, such as `know index` and successful `know verify` flows.

The lockfile is a human-readable reflection of the current repository state, similar to a dependency lockfile. It is useful in code review because changes to code, rules, links, or verification approvals produce visible diffs in `.know/`.

The lockfile is not the authority for whether a relationship is currently verified. Know proves that by recomputing the expected lockfile from knowledge files plus the current repository code and comparing the result with the committed file. A stale lockfile means the committed reflection no longer describes the current repository.

```toml
version = 1
source_model_hash = "sha256:..."
link_verification_hash = "sha256:..."
resolved_model_hash = "sha256:..."

[[links]]
rule = "customer-email-immutable"
kind = "path"
target = "src/customer/email.ts"
status = "verified"
reasons = []

[[links]]
rule = "customer-email-immutable"
kind = "glob"
target = "src/customer/**/*.ts"
status = "unverified"
reasons = ["target-fingerprint-changed"]

[[links]]
rule = "customer-email-immutable"
kind = "symbol"
target = "src/billing/invoice.ts#Invoice.calculateTotal"
status = "broken"
reasons = ["symbol-not-found"]

[[unlinked_rules]]
rule = "legacy-invoice-export-reviewed"
```

Lockfile entries are written deterministically with normalized values and stable ordering. Link entries are keyed by owning rule, kind, and canonical target. Status values are `verified`, `unverified`, or `broken`. Unlinked rules are represented separately because no rule-link-code relationship exists yet.

The lockfile intentionally does not repeat the per-link `rule_fingerprint`, `link_fingerprint`, or `target_fingerprint` values from `.know/linkVerification.toml`. Those fingerprints are the approval record and live in one place. The lockfile stores `link_verification_hash` so changes to the approval file still affect freshness without duplicating user-approved fingerprint data in every generated status entry.

`reasons` is empty for verified links. For unverified links it may include `no-verification-entry`, `rule-fingerprint-changed`, `link-fingerprint-changed`, or `target-fingerprint-changed`. For broken links it may include `target-not-found`, `glob-empty`, `unsupported-language`, `parse-failed`, `symbol-not-found`, or `invalid-link-definition`.

## Concepts

Concepts have a required `id`. The ID is a stable human-readable slug used by rules to reference the concept.

```toml
[[concepts]]
id = "customer-identity"
description = "Customer identity is the durable identity model used for billing, access, and audit history."
tags = ["tag1", "tag2"]
```
