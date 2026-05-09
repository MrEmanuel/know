## Know primitives

The conceptual building blocks of Know that provide the mental model for the system.

_Note: Descriptions in this section are implementation-agnostic_

### Rules

Rules are the core of Know. Rules explicitly define business rules, architecture decisions, domain-specific constraints, etc. Rules own their links to specific parts of the source code.

**What is fundamentally a rule?** A rule is a _proposition about code that becomes stale when that code changes_. More precisely, a rule:

- Is stated as a declarative requirement about code behavior or structure
- Has a rationale explaining _why_ it exists (not just what it says)
- Becomes _unverified_ when the code it references changes (making freshness visible)
- Is discoverable before change, surfacing intent to both humans and AI agents

This is narrower than a "guideline" (which might be aspirational) and narrower than a "fact about code" (which might be observable but not prescriptive). Rules exist today in codebases as undocumented tribal knowledge; Know's purpose is to make them explicit and connected to code.

Each rule has a required stable human-readable ID, description, and rationale. The ID is a slug used for references, editing flows, indexing, and output. It is not an opaque generated identifier. The rationale captures why the rule exists, so `know context` can surface intent alongside the constraint.

Rule IDs use lowercase ASCII kebab-case and must be unique across all rules in the project.

Rules may be valid before they have any inline links. A rule with no links is `unlinked`: it is preserved, searchable, and reportable, but it will not be returned by target-based `know context` until it is linked to code.

### Links

Links make rules useful. A link is the relationship between one rule and one code target, such as a path, glob, or symbol. Verification state is owned by that rule-link-code relationship, even when several rules point at the same target.

Links do not have their own required source-defined IDs. They are part of their owning rule, and duplicate links with the same kind and target under one rule are invalid.

### Concepts

Concepts are snippets of information that can be added to rules to give them context. To avoid repetition, a concept can be defined once and referenced in multiple rules.

Each concept has a required stable human-readable ID. Rules reference concepts by this ID.

Concept IDs use lowercase ASCII kebab-case and must be unique across all concepts in the project. Rule IDs and concept IDs may overlap because references are typed by context.
