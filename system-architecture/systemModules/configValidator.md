# Config validator

Config validation is a first-class library function, used by both the CLI and the TUI. It ensures that the knowledge files provided by the user are correct, complete, and adhere to the expected schema before any parsing or processing occurs.

Knowledge files use a strict schema. Unknown fields are validation errors. This includes unknown fields on rules, concepts, inline links, the generated link-verification approval file, and the generated link-verification lockfile.

Strict validation exists so spelling mistakes in knowledge files do not silently remove required meaning. For example, `rationle` must fail validation instead of being ignored as an unknown field.

Tags are the supported lightweight mechanism for classification, filtering, search, context, and project-specific grouping.

Tags are free-form strings. They are trimmed for validation, must be non-empty after trimming, and must be no longer than 80 characters. Tags must not contain newlines or control characters. Spaces, punctuation, uppercase letters, Unicode, and natural-language phrases are allowed.

Tags are preserved as written and are not normalized to the rule and concept ID slug format.

Rule IDs and concept IDs must use lowercase ASCII kebab-case. They may contain lowercase letters, digits, and single hyphens between segments. They must not contain whitespace, uppercase letters, underscores, punctuation other than hyphen, leading hyphens, trailing hyphens, or repeated hyphens.

Rule IDs must be unique across all rules in the project. Concept IDs must be unique across all concepts in the project. Rule IDs and concept IDs may overlap because references are typed by context.

Rules may have zero inline links. A rule without links is valid and is classified as `unlinked` by status, check, and reporting flows.

`include_ignored` is valid only on glob links and defaults to `false`. Using `include_ignored` on a path or symbol link is invalid.

Path and glob targets in knowledge files must use normalized repository-root-relative paths with `/` separators. Absolute paths, `..` segments, leading `./`, and backslashes are invalid in knowledge files and generated verification entries.

Symbol targets in knowledge files and generated verification entries must use file-scoped `path#symbol` form. The path portion follows the same canonical path rules as path links. Symbol targets without a `#` separator are invalid in knowledge files, even though CLI commands may accept bare symbol input as a convenience when it resolves unambiguously.

`.know/linkVerification.lock.toml` is generated but still strictly validated. Link lockfile statuses must be `verified`, `unverified`, or `broken`. Lockfile reasons must use known reason codes, such as `no-verification-entry`, `rule-fingerprint-changed`, `link-fingerprint-changed`, `target-fingerprint-changed`, `target-not-found`, `glob-empty`, `unsupported-language`, `parse-failed`, `symbol-not-found`, or `invalid-link-definition`.

The lockfile must not contain status labels outside generated status records. Source rule and inline link definitions never store `status`, `reason`, `reasons`, timestamps, or fingerprints.

For tech stack, see `../techStack.md`.
