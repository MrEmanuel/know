# Know — Devpost submission source

This is the version-controlled source for the OpenAI Build Week submission.
Copy the fields below into Devpost, then replace the bracketed session ID only
after retrieving it from the primary Codex build thread.

## Submission fields

- **Name:** Know Memory System
- **Tagline:** Know surfaces the business rules, decisions, and constraints that apply to code before a human or AI agent changes it.
- **Category:** Developer Tools
- **Repository:** https://github.com/MrEmanuel/know
- **Demo video:** https://youtube.com/shorts/3jkhNDFPlpg?feature=share
- **Codex `/feedback` session ID:** `[paste the primary Build Week session ID]`

## Project description

### Inspiration

Codebases have source code, tests, static documentation, and version control.
What they usually do not have is memory that appears at the moment a change is
made.

Important rules often live in a senior engineer's head, a stale document, or a
conversation that the person—or AI agent—about to edit the code will never see.
That creates a predictable failure mode: an apparently clean change breaks
business intent, an edge case, or an architectural decision that was never
made explicit.

Know exists to make those constraints visible before the change, rather than
discoverable only after the regression.

### What it does

Know is an Active Memory system for code: a Rust CLI that stores project rules
as versioned TOML files beside the repository. A rule has a constraint, its
rationale, and links to the files or globs it protects.

`know context <target>` retrieves the rules that apply to a file before it is
changed. When linked code changes, Know marks that rule-to-code relationship as
unverified, making the need for human review visible instead of silently
assuming the old rule still applies.

The included SkyRoute demo makes this concrete. A passenger can turn two during
a trip, so fare category must be calculated for every flight segment. A
tempting refactor would calculate it once at booking time. When Codex is about
to edit the protected pricing code, Know's repository hook injects the
second-birthday rule and its rationale into the agent's context before the
edit. The hook is deliberately advisory: it supplies missing project knowledge;
the human still decides what to change and whether to re-verify the rule.

### How we built it

Know began with an intentionally thorough design phase: defining the smallest
durable model for rules, links, freshness, and human verification before
expanding the product surface. During Build Week, that specification became a
working Rust MVP with a packaged CLI, SQLite read model, TOML knowledge files,
path and glob links, verification-state tracking, automated tests, a
checksum-verified installer, and a Codex pre-edit hook.

I used Codex as a collaborative engineering partner throughout the work: to
interrogate design assumptions, turn the specification into an executable MVP,
review edge cases, refine the demo, and tighten the installation and testing
path. GPT-5.6 was used during the Build Week implementation and polish work to
reason through the CLI/hook behavior, iterate on the tests and demo, and
improve the judge-facing documentation. The commit history documents the
working MVP and demo work created during the submission period.

### Challenges we ran into

The difficult part was not merely retrieving documentation. It was defining a
trust model that is useful without becoming an obstacle: rules need to be easy
to retrieve before a change, but Know must never automatically claim that a
rule remains valid after related code changes.

The resulting design separates current source files, explicit human-approved
verification state, and a disposable SQLite read model. This gives fast,
structured context queries without turning generated state into the source of
truth.

### Accomplishments that we are proud of

- A working end-to-end loop: initialize → write and link a rule → index → query
  context → explicitly verify → change linked code → see the relationship become
  unverified.
- A concrete Codex integration that demonstrates pre-edit context injection,
  rather than only describing an agent workflow.
- A focused, reproducible 90-second demo that makes the user value visible:
  Know prevents a plausible but unsafe code change.
- A deliberately small MVP that proves the core before adding symbol
  resolution, an IDE UI, or semantic search.

### What we learned

AI agents make implicit engineering knowledge more valuable, not less. The
quality of an agent's change is bounded by the constraints it receives at the
moment it acts. A long document somewhere in a repository is not enough;
context must be connected to the code it protects and surfaced in the workflow.

We also learned that Codex is particularly effective as a critical thinking and
implementation partner when the human owns the product judgment and the agent
can repeatedly test assumptions against a clear system model.

### What's next for Know

The next step is to extend the proven lifecycle while protecting its core
promise: richer symbol links, a TUI and IDE experience, better reporting, and
more integration surfaces for humans and agents. The invariant will remain the
same: Know should surface the right constraint before a change, and make it
obvious when a human needs to re-confirm that constraint afterwards.

## Judge testing instructions

### Supported platform

macOS and Linux. The Build Week demo targets Codex CLI; the VS Code extension
does not run the repository hook used in this demo.

### Fast path

```sh
git clone https://github.com/MrEmanuel/know.git
cd know
./install.sh
./demo.sh
```

`demo.sh` indexes the included SkyRoute playground, runs the two-leg itinerary,
and prints the exact prompt for the Codex demonstration. Start `codex` from the
repository, use `/hooks` to trust the repository hook if prompted, then paste
that printed prompt. Before Codex edits the protected pricing file, it should
receive the second-birthday rule and explain why the refactor is unsafe.

### Test suite

```sh
cargo test
```

## Submission checklist

- [ ] Replace the session-ID placeholder above.
- [ ] Confirm the YouTube demo is public or unlisted and under three minutes.
- [ ] Confirm the voiceover explicitly covers the product, Codex, and GPT-5.6.
- [ ] Confirm the Devpost category is **Developer Tools**.
- [ ] Confirm the repository URL, current README, and demo instructions match.
- [ ] Confirm the Devpost project is submitted, not merely saved as a draft.
