The system revolves around `rules`, but also has `links` and `concepts`. `concepts` are optional. `rules` and `links` are required for the system to work.

v0.1 is the MVP.
It's the most simple version of the app.

- Node module, installed via npm or used via npx, cli callable via 'yarn know context ..'
- Links are simple path globs.
- Manually add rules, links and concepts
- All in one file.

v0.2 is the Beta version

- Support splitting rules, concepts and links in multiple files
- Tree sitter used for better links and code agnosticity
- platform agnostic, bin release
- Sophisticated cli, with dropdown options and search capabilities thanks to tree sitter. Pick between concepts, rules, and semantically relevant functions, classes, files, etc.
- vector db for semantic search
- Sophisticated AI-bot injections with middleware, hooks, harness specific instructions, etc.
- CLI and instructions to allow agents to add rules, concepts and links.

v1.0 is the goal. Not necessarily the 3rd version. Might take many releases until it's at v1.0 stage.

- Github actions included
- gitub automatic tool like dependabot
- Enterprice monitization
- Same licence as git?

Template:

```md
## Concept: concept-id

Explain a reusable domain concept.

---

## Rule: rule-id

Concepts:

- `concept-id`

State what must be true or what must be checked.

Verify that:

- expected behavior is preserved

- relevant tests or edge cases are considered

---

## Link: link-id

Files:

- `path/or/glob/**`

Rules:

- `rule-id`

Concepts:

- `concept-id`
```

Example:

```md
## Concept: payment-idempotency

Payment idempotency means retrying the same payment-creation request must not create a second charge.

A request is considered the same request when it has the same idempotency key.

---

## Rule: payment-creation-idempotency

Concepts:

- `payment-idempotency`

Payment-creating code must preserve idempotency.

Verify that:

- retries use the same idempotency key
- duplicate requests return the original result

---

## Link: payments-code

Files:

- `src/payments/**`
- `tests/payments/**`

Rules:

- `payment-creation-idempotency`
```

```

```
