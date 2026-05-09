# Link validator

Validates inline rule links, which connect rules to code. It resolves link targets, computes current verification fingerprints, and marks rule-link-code relationships as unverified when the owning rule, inline link definition, or resolved code target changes.

The link validator does not write `.know/linkVerification.toml` by itself. Verification workflows such as `know verify` use the computed fingerprints and write approved entries to `.know/linkVerification.toml`.

The link validator also does not treat persisted status labels as source truth. Current link status is derived from current fingerprints and emitted into `.know/linkVerification.lock.toml` by analysis workflows such as `know index` and successful `know verify` flows.

Path links must resolve to exactly one repository file. A directory is not a valid path target. When a user points a path link at a directory, the validator should report an actionable error suggesting a glob link for directory or subtree coverage.

Path and glob targets are resolved from normalized repository-root-relative paths with `/` separators. Absolute paths, `..` segments, leading `./`, and backslashes are invalid in source link definitions.

Symbol links use canonical file-scoped `path#symbol` targets in source files and generated verification entries. The path portion follows the same canonical path rules as path links. The symbol portion is resolved structurally with Tree-sitter where a supported grammar exists.

The symbol portion is a dotted symbol path made from named structural declarations, such as classes, structs, interfaces, traits, enums, functions, methods, and similar top-level or nested declarations. Symbol links do not target arbitrary expressions, local variables, anonymous callbacks, or line numbers in the baseline system.

For symbol links, unsupported languages, parse failures, and unresolved symbols are broken targets. Diagnostics should distinguish `unsupported-language`, `parse-failed`, and `symbol-not-found`.

Glob links resolve to repository files only. Directories are not included in the resolved target set. Invalid glob syntax makes the link definition invalid. A syntactically valid glob that resolves to zero files is broken.

Glob links respect repository ignore rules, such as `.gitignore`, by default. Ignored files are excluded from the resolved target set unless the link sets `include_ignored = true`. `include_ignored` defaults to `false` and is valid only on glob links. Explicit path links may target ignored files when the file exists.

For tech stack, see `../techStack.md`.
