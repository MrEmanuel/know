## Know primitives

The conceptual building blocks of Know that provide the mental model for the system.

_Note: Descriptions in this section are implementation-agnostic_

### Rules

Rules are the core of Know. Rules explicitly define business rules, architecture decisions, domain-specific constraints, etc. Rules own their links to specific parts of the source code.

### Links

Links make rules useful. A link is the relationship between one rule and one code target, such as a path, glob, or symbol. Link verification status is owned by that rule-code pair, even when several rules point at the same target.

### Concepts

Concepts are snippets of information that can be added to rules to give them context. To avoid repetition, a concept can be defined once and referenced in multiple rules.
