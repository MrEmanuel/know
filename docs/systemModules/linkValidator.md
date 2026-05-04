# Link validator

Validates inline rule links, which connect rules to code. It resolves link targets, records verification fingerprints in `.know/verification.toml`, and marks rule-link-code relationships as unverified when the owning rule, inline link definition, or resolved code target changes.

For tech stack, see `../techStack.md`.
