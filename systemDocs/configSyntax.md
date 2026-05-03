# Config syntax.

Defintions and examples of the syntax used in the .toml config files for rules, links, and concepts.

Tags can be added to rules, links, and concepts for better organization and discoverability. They can be used for filtering and searching in the CLI and TUI.

## Rules

```toml
[[rules]]
id = "rule1"
description = "This is a rule that describes a business constraint or requirement."
rationale = "This is the rationale behind the rule, explaining why it exists and what it aims to achieve."
concepts = ["concept1", "concept2"]
links = ["link1", "link2"]
tags = ["tag1", "tag2"]
```

## Links

```toml
[[links]]
id = "link1"
links = [
    "src/utils.ts",
    "src/**/*.ts",
    "src/index.ts:myFunction"
]
status = "validated" # valid | unvalidated | broken

```

## Concepts

```toml
[[concepts]]
id = "concept1"
description = "This is a concept that describes a high-level idea or abstraction that is relevant to the project. Many rules that relate to the same concept can reference it in one place.
tags = ["tag1", "tag2"]

```
