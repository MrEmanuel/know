<!-- know:start -->
## Repository knowledge

This repository uses `know` for structured domain knowledge. The source of truth lives in `.knowledge/`; generated indexes live in `.knowledge/indexes/`.

Before editing any file, run:

    yarn know context <path>

Treat returned **active rules** as constraints on your change. If a rule is **stale**, read its rationale and either confirm it or propose a change.

Full workflow: `.knowledge/agent-instructions.md`
<!-- know:end -->
