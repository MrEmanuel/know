## Know primitives

The conceptual building blocks of Know that provide the mental model for the system.

_Note: Descriptions in this section are implementation-agnostic_

### Rules

Rules are the core of Know. Rules explicitly define business rules, architecture decisions, domain-specific constraints, etc. Rules own their links to specific parts of the source code.

Each rule has a required stable human-readable ID, description, and rationale. The ID is a slug used for references, editing flows, indexing, and output. It is not an opaque generated identifier. The rationale captures why the rule exists, so `know context` can surface intent alongside the constraint.

### Links

Links make rules useful. A link is the relationship between one rule and one code target, such as a path, glob, or symbol. Verification state is owned by that rule-link-code relationship, even when several rules point at the same target.

Links do not have their own required source-defined IDs. They are part of their owning rule, and duplicate links with the same kind and target under one rule are invalid.

### Concepts

Concepts are snippets of information that can be added to rules to give them context. To avoid repetition, a concept can be defined once and referenced in multiple rules.

Each concept has a required stable human-readable ID. Rules reference concepts by this ID.
