# Config syntax

Definitions and examples of the syntax used in the .toml config files for rules and concepts.

Tags can be added to rules, inline links, and concepts for better organization and discoverability. They can be used for filtering and searching in the CLI and TUI.

Links are defined inline under rules. The source-of-truth relationship is the rule-code pair: a specific rule claims relevance to a specific code target. Each inline link owns its own verification status, even when multiple rules point to the same file, glob, or symbol.

## Rules

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
status = "verified" # verified | unverified | broken
verified_at = "2026-05-04T10:00:00Z"
verified_rule_fingerprint = "sha256:..." # TODO: For globs that are resolved to multiple files, how do we handle fingerprinting and verification?
verified_target_fingerprint = "sha256:..."

[[rules.links]]
target = "src/customer/**/*.ts"
kind = "glob"
status = "unverified"
```

## Inline links

```toml
[[rules.links]]
target = "src/index.ts:myFunction"
kind = "symbol"
status = "unverified"
tags = ["entrypoint"]
```

New links may omit `status`; the validator treats them as `unverified`. Fingerprint fields are written by the validator when a rule-link pair is verified.

## Concepts

```toml
[[concepts]]
id = "customer-identity"
description = "Customer identity is the durable identity model used for billing, access, and audit history."
tags = ["tag1", "tag2"]
```
