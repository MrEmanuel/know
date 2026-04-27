---
id: concept.rules
title: Rules
status: active
tags:
  - rules
  - know
---

# Rules

Rules are the center of the Know system. They make explicit what is often implicit about a codebase: business rules, design decisions, taste, or other important constraints that cannot be expressed clearly enough in code.

A rule owns its anchors, review state, and rationale. Anchors identify the code that can affect the rule. Rationale explains why the rule exists so a person or agent can decide whether to preserve it, re-confirm it, or change it deliberately.

## Rule example

- id: knowledge.age-limit.under-18-cant-view
  statement: "Users under 18 can't view the content of the application"
  status: active
  applies_to: concept.age-limit
  anchors:
  - source: index.ts
  rationale: "The current launch jurisdiction allows access only for adults."

In the above example, the web page should only be visible to users 18 and older. If the web page launches somewhere with a different limit and a developer or agent changes the code, Know surfaces the rule and rationale before the edit. Their options are to keep the rule, update the rule, or mark it deprecated.
