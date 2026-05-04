# Future ideas

This document collects ideas that may be useful for future development, but are not part of the normative system definition in the other docs.

## Rule-guided code changes

A user could edit system rules, causing related links to become unverified. An AI agent could then discover the unverified rule-code pairs and update the code to satisfy the changed rules.

This would let rules guide system development in a way that resembles test-driven development, but with rules instead of tests.

## Additional notification surfaces

- Git hooks, such as a pre-commit hook that checks for unverified links and prevents the commit or warns the user.
- GitHub Actions.
- GitHub PR bot.
- GitHub agent.
- Jira integration.

## Additional product surfaces

- IDE extension.
- CodeLens.
- Web UI.
- Multi-repo federation.

## Additional link types and context targets

- In-code link comments.
- Rule links embedded in code.
- Executable rule links, such as `test:` targets.
- Connect rules to tests.
- Symbol-level `know context --symbol`.

## Additional implementation options

- LSP integration as a complement to Tree-sitter.
- JSON5 as an additional source file format.
