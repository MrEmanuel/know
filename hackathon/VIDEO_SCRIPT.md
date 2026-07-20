# Know — OpenAI Build Week demo script

**Target runtime:** 2 minutes 35 seconds. Leave up to 25 seconds of margin
under the three-minute limit.

**Demo objective:** Show a working developer tool preventing a plausible but
unsafe AI-agent edit, then make the use of Codex and GPT-5.6 explicit.

## Before recording

- Start in a clean clone with the terminal large enough to read.
- Run `./install.sh` and `./demo.sh` once to confirm the path works.
- Start Codex from the repository and approve the repository hook through
  `/hooks` if prompted.
- Have the prompt from `demo.sh` ready to paste; do not spend the recording
  typing it.
- Record a voiceover. Do not rely on captions or music alone.

## Script and shot list

| Time | Screen | Voiceover |
| --- | --- | --- |
| 0:00–0:12 | Title card: `Know — Active Memory for Code` | “AI coding agents can write code quickly, but they do not automatically know the business rules hidden in a team's history. Know gives that missing context to people and agents before they change code.” |
| 0:12–0:28 | README quick-start and terminal running `./install.sh` | “Know is a working Rust CLI. Rules live as versioned TOML files in the repository, linked directly to the code they protect.” |
| 0:28–0:50 | Run `./demo.sh`; show the two SkyRoute segments and different passenger categories | “This SkyRoute example contains a rule that is easy to miss: a passenger can turn two during a trip. Their fare category must be calculated independently for every flight segment.” |
| 0:50–1:08 | Show `know context examples/skyroute/skyroute/pricing.py` | “Know retrieves the relevant rule, its rationale, and its verification status for the pricing code before it is changed.” |
| 1:08–1:42 | Codex terminal; paste the unsafe refactor prompt; wait for Know pre-edit context | “Now I ask Codex for a tempting simplification: calculate passenger category once at booking time and reuse it for every segment. Before it edits the protected file, Know's repository hook injects the second-birthday rule into Codex's context.” |
| 1:42–1:58 | Zoom on Codex response explaining why the refactor is unsafe | “Codex can now explain why this refactor would be wrong instead of confidently making a regression. Know is advisory: it supplies the missing knowledge, and the human remains responsible for the decision.” |
| 1:58–2:17 | Show one rule file, then the `know check` / verification-status output | “Rules are linked to code. When that code changes, Know marks the relationship unverified until a human explicitly reviews it. That makes the state of project knowledge visible.” |
| 2:17–2:35 | README, tests, and repository link | “I built Know during OpenAI Build Week with Codex and GPT-5.6 as collaborative engineering partners: from design review and implementation through tests, the hook, and this reproducible demo. Know is Active Memory for code: the right rule, before the risky change.” |

## Exact unsafe-refactor prompt

```text
Simplify SkyRoute by calculating passenger category once when the booking is created and storing it on Passenger. Reuse it for every flight segment.
```

## Recording checklist

- [ ] The video is no more than 3:00.
- [ ] The terminal text and Codex pre-edit context are legible at normal speed.
- [ ] The demo visibly works; do not only narrate screenshots.
- [ ] The voiceover says both “Codex” and “GPT-5.6,” and explains their use.
- [ ] The upload is public or unlisted and opens while signed out.
