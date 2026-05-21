# Jobs To Be Done Analysis

This document applies Clayton Christensen's Jobs To Be Done framing to Know.
The goal is to clarify what progress users are trying to make, which needs the
system should prioritize, and how Know should be framed in product and system
documentation.

## Summary

Know is hired when a person or AI agent is about to change code and needs to
know which non-obvious rules apply before the change is made.

The strongest framing is not "documentation" or "knowledge base." Know's value
is not storing knowledge. Its value is making hidden constraints appear at the
exact moment they can prevent a bad change.

## Core Job

> When I or an AI agent am about to change unfamiliar or sensitive code, help me
> see the non-obvious rules that matter, so I do not break business intent,
> domain constraints, or architectural invariants by accident.

This is the primary job Know should optimize for.

## Product Positioning

Know is the context layer that tells humans and AI agents which rules apply
before they change code.

Stronger positioning phrases:

- Turn tribal knowledge into pre-change code context.
- Give AI agents the rules they need before they edit.
- Connect business intent to code, and know when that connection goes stale.
- Surface hidden constraints before they become broken changes.

Avoid leading with:

- Documentation platform.
- Knowledge base.
- Rules repository.
- Wiki for code.

Those descriptions point at storage. Know should point at timely action.

## Main Recipient And Buyer

The main recipient is the actor changing code:

- AI coding agents.
- Developers working in unfamiliar or sensitive parts of the system.
- New team members learning why code behaves the way it does.

The economic buyer is likely an engineering leader, platform lead, CTO, or
technical founder who is worried about:

- AI-assisted changes violating hidden rules.
- Senior engineers becoming bottlenecks for context.
- Business-critical domain knowledge leaving with people.
- Onboarding drag in complex codebases.
- Code review catching context problems too late.

The maintainer is usually a senior engineer, domain expert, or technical owner
who can capture rules and verify that rule-code relationships still hold.

## Best Initial Market

Know is most valuable for engineering teams using AI agents or fast-moving
developers in domain-heavy codebases where hidden rules can cause expensive
mistakes.

Good early segments:

- Fintech and billing systems.
- Healthcare and insurance systems.
- Compliance-heavy SaaS.
- Internal platforms with legacy domain rules.
- Codebases where business rules live in Confluence, Jira, PR comments, or a
  few senior people's heads.

## Stakeholder Jobs

| Stakeholder | Job To Be Done | Current Fit | Main Gap |
| --- | --- | --- | --- |
| AI coding agent | Before editing a file, receive only the relevant constraints in machine-readable form. | Strong: `know context`, JSON output, hooks, and AGENTS.md contract. | Hook/plugin contract needs to become concrete and demoable. |
| Developer | When touching code I do not fully own, understand the rule and the why before I edit. | Strong: CLI, IDE plugin, TUI, rationale-first rules. | Adoption path and first-rule workflow need sharper UX. |
| Senior engineer / domain expert | Capture critical judgment once and connect it to the code that can invalidate it. | Strong conceptually. | Rule capture workflow is underdesigned: interviews, imports, suggestions, review flow. |
| Engineering manager | See whether important rule-code relationships are covered, stale, broken, or unverified. | Medium: `status`, `report`, and coverage ideas exist. | Needs ownership, risk views, thresholds, and trend reporting. |
| Business owner / product owner | Preserve business intent as people leave and AI/code velocity increases. | Medium-low today. | Needs non-technical summaries and clearer business-value language. |
| New team member | Learn why the system behaves the way it does while navigating code. | Medium: browse, search, concepts. | Needs onboarding-oriented views and examples. |

## Functional Needs

- Query a file, glob, or symbol and get the rules that apply.
- Link a rule to the exact code whose change should surface or reverify it.
- Show whether a rule-code relationship is verified, unverified, or broken.
- Explain the rationale, not only the rule text.
- Support humans, scripts, CI, IDEs, and AI agents.
- Keep source of truth plain text and Git-native.
- Provide small, focused output that fits into agent context.
- Make rule health visible without making every unverified relationship a
  blocking emergency.

## Emotional Needs

- Confidence before editing sensitive code.
- Less fear of "I did not know that rule existed."
- Trust that old knowledge does not silently become false.
- Relief that senior engineers do not have to personally remember every
  constraint during every review.
- Confidence that AI agents are operating with relevant local context.

## Social Needs

- Reduce dependence on key individuals.
- Let senior engineers encode judgment without becoming constant bottlenecks.
- Give managers evidence that important knowledge is maintained.
- Make AI agents acceptable collaborators in codebases with hidden constraints.
- Help product and domain owners see whether important intent is connected to
  implementation.

## Competing Hires

Know competes with the workarounds teams already use:

- Tribal memory.
- PR review comments.
- Confluence and Jira pages disconnected from code.
- ADRs that explain decisions but do not surface before edits.
- Code comments that are local but not queryable or verifiable.
- Tests, which catch some behavior but not all intent.
- Cursor, Copilot, and AGENTS.md rules that provide instructions but weak
  code-level freshness.
- CODEOWNERS, which routes review but does not explain business constraints.

Know's differentiation is code-linked intent with freshness.

## Implications For The Product

The product should optimize for the pre-change moment.

High-leverage capabilities:

- `know context <target>` as the central workflow.
- IDE and agent integrations that call `know context` before edits.
- A rule capture flow that starts from "what code does this rule apply to?"
- Rationale-first output that explains why the rule exists.
- Verification status that shows aging without implying that stale means wrong.
- Reports that make rule health visible to leads without turning every warning
  into an interruption.

Lower-priority or risky positioning:

- General documentation management.
- Broad company principles.
- Project-wide guidelines that do not link to code.
- Post-change CI bot behavior as the primary value proposition.

CI, reports, and bots are useful health surfaces. They should support the
pre-change job, not replace it as the center of the product.

## Language Guidance

Product and system language should describe Know as a system for surfacing
code-specific rules before edits.

Use language like:

- "pre-change code context"
- "hidden constraints"
- "rule-code relationship"
- "business intent connected to code"
- "unverified when linked code changes"
- "the rules that apply before you edit"

Avoid language that makes Know sound like passive storage:

- "documentation platform"
- "knowledge base"
- "store knowledge"
- "rules repository"
- "central wiki"

The term "knowledge files" is still useful as a technical term for the TOML
files under `.know/`. It should not be the main value proposition.
