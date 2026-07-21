# Know — OpenAI Build Week demo script

**Target runtime:** 2 minutes 35 seconds. Leave up to 25 seconds of margin
under the three-minute limit.

**Demo objective:** Use an AI-generated video to introduce Know as Active Memory
for code, step through the existing infographic, and explain the Thought Driven
Development process used to build it.

## Script and shot list

| Time | Screen | Voiceover |
| --- | --- | --- |
| 0:00–0:18 | Animated title card: `Know — Active Memory for Code`; show the elevator-pitch text | “Your AI agent is an expert savant coder on speed, with ADHD… who was born yesterday. Know introduces Active Memory for software: it connects a team’s rules and decisions directly to the code they protect, then surfaces the right context before a human or AI changes that code.” |
| 0:18–0:32 | Animated README headline and knowledge files linking to code | “Git gave software version control. Know gives it memory. Rules live as versioned knowledge files in the repository, linked directly to the code they protect.” |
| 0:32–0:46 | Infographic overview: `How the CLI and AI Work Together` | “This is the workflow. The AI plans and searches the codebase. Know provides relevant project knowledge. The AI reasons with that context, updates its plan, and explains the decision.” |
| 0:46–1:00 | Infographic panel 1: AI request, initial plan, and files searched | “In this SkyRoute example, Codex receives a request to simplify passenger pricing. It explores the models, booking flow, pricing code, tests, and README before deciding what to change.” |
| 1:00–1:15 | Infographic panel 2: Know context injection; zoom on the second-birthday rule | “Know sees which files Codex is working with and injects the matching rule: passenger category is departure-date specific. A passenger can turn two between the outbound and return flights.” |
| 1:15–1:30 | Infographic panel 3: AI analysis and updated plan | “With that context, Codex catches the problem. Storing one category on Passenger would make the return segment use stale information, so the plan changes: do not make the unsafe edit, explain why, and find a safe alternative.” |
| 1:30–1:45 | Infographic panel 4: explanation and safe alternative; show the outcome row | “The result is not just a refusal. Codex explains the business rule and can recommend caching by passenger and departure date while preserving per-segment calculation.” |
| 1:45–2:05 | Animated terminal replay of `./demo.sh`; show the two SkyRoute segments and different passenger categories | “The working demo makes this concrete. This passenger crosses an age boundary during the itinerary, so the fare category is calculated independently for each flight segment.” |
| 2:05–2:22 | Animated Codex terminal; show the unsafe refactor prompt and Know pre-edit context | “The request is to calculate passenger category once when the booking is created and reuse it for every segment. Before the protected file is edited, Know injects the rule into Codex’s context.” |
| 2:22–2:35 | Animated Codex explanation, then README, tests, and repository link | “Know was built with Codex and GPT-5.6 using Thought Driven Development: a two-step process. First, thoughtful design and specification. Then, implementation and testing. The result is Active Memory for code—the right rule, before the risky change.” |

## Exact unsafe-refactor prompt

```text
Simplify SkyRoute by calculating passenger category once when the booking is created and storing it on Passenger. Reuse it for every flight segment.
```

## AI-video production checklist

- [ ] The video is no more than 3:00.
- [ ] The elevator pitch is clear in the opening seconds.
- [ ] The infographic is legible and the four steps are shown in order.
- [ ] The AI-generated video animates the demo flow; it does not imply a human is presenting it live.
- [ ] The voiceover says both “Codex” and “GPT-5.6.”
- [ ] The voiceover explicitly says: “First, thoughtful design and specification. Then, implementation and testing.”
- [ ] The voiceover names “Thought Driven Development.”
- [ ] The upload is public or unlisted and opens while signed out.
- [ ] Use the attached infographics image as reference for the animation. The video should not be a static image of the infographic.
