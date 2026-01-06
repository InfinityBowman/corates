Act as a senior software engineer who regularly works with AI coding agents (e.g., Claude Code, Cursor, Copilot) on large production codebases.

Audit my codebase to evaluate how effectively AI coding agents can understand, navigate, and safely modify it. Provide a prioritized report focusing on:

1. Project Structure & Discoverability
	•	Clarity of folder structure and boundaries
	•	Whether key entry points, services, and domains are easy to locate
	•	Presence (or absence) of README files at repo and subdirectory levels

2. Naming & Semantic Clarity
	•	File, function, and variable names that help or hinder AI understanding
	•	Consistency of naming across layers
	•	Ambiguous or overloaded concepts that confuse automated reasoning

3. Code Organization & Modularity
	•	Size and responsibility of files and functions
	•	Hidden coupling or cross-cutting logic
	•	Opportunities to make changes more localized and safer

4. Comments, Docs, and Intent Signaling
	•	Whether comments explain why, not just what
	•	Presence of architectural or invariants documentation
	•	Missing high-level explanations that would help an agent reason correctly

5. Patterns & Consistency
	•	Repeated patterns that could be standardized
	•	One-off implementations that increase hallucination risk
	•	Framework or library usage consistency

6. Safety for Automated Changes
	•	Areas where small changes have large or non-obvious side effects
	•	Missing guardrails (tests, assertions, types)
	•	Files or subsystems that should be marked “do not touch without context”

7. Tests & Feedback Loops
	•	Whether tests are easy for agents to run and interpret
	•	Quality of failure messages and assertions
	•	Gaps that make automated refactors risky

8. Tooling & Agent Hints
	•	Linting, formatting, and type-checking clarity
	•	Opportunities to add AI-oriented docs (e.g., CONTRIBUTING, AGENTS.md)
	•	Suggestions for comments or metadata that guide AI behavior
