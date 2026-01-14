---
name: analyze
description: Analyze the current codebase against specific patterns and best practices
argument-hint: '[topic] - architecture, security, error-handling, local-first'
allowed-tools:
  - Task
  - Read
  - Glob
  - Grep
---

# Codebase Analysis Command

Trigger a comprehensive analysis of the current codebase.

## Usage

```
/analyze                     # Interactive topic selection
/analyze architecture        # Architecture patterns analysis
/analyze security            # Security patterns analysis
/analyze error-handling      # Error handling analysis
/analyze local-first         # Local-first patterns analysis
/analyze compare [path]      # Compare against another repo
```

## Instructions

When invoked:

1. **Parse the argument** to determine the analysis topic:
   - `architecture` or `arch` -> architecture-patterns
   - `security` or `sec` -> security-patterns
   - `error-handling` or `errors` -> error-handling
   - `local-first` or `offline` -> local-first-patterns
   - `compare [path]` -> repo comparison mode

2. **For standard analysis**: Launch the `codebase-analyzer` agent with the topic

3. **For comparison**: Launch the `repo-comparator` agent with both paths

4. **If no topic provided**: Ask the user which topic to analyze:
   - Architecture patterns (structure, SOLID, layering)
   - Security patterns (auth, validation, vulnerabilities)
   - Error handling (boundaries, recovery, logging)
   - Local-first patterns (offline, sync, conflicts)

5. **Report location**: All reports are saved to `packages/docs/audits/`

## Example Invocations

```
User: /analyze security
-> Launch codebase-analyzer agent focused on security-patterns skill

User: /analyze compare ~/other-project
-> Launch repo-comparator agent comparing current repo with ~/other-project

User: /analyze
-> Ask user to select a topic, then launch appropriate agent
```
