# Codebase Analysis Plugin

Analyze codebases against architecture patterns, security best practices, error handling, and other standards.

## Features

- **Configurable analysis topics**: Choose what to analyze (architecture, security, etc.)
- **Autonomous agents**: Thorough exploration and comprehensive reports
- **Comparison mode**: Compare your codebase against reference implementations
- **Extensible**: Add new analysis topics by creating new skills

## Usage

### Quick Analysis

```
/analyze architecture    # Review code structure, SOLID, layering
/analyze security        # Find vulnerabilities, check auth patterns
/analyze error-handling  # Audit error boundaries, logging, recovery
/analyze local-first     # Evaluate offline support, sync, conflicts
```

### Compare Repositories

```
/analyze compare /path/to/other/repo
```

### Interactive

```
/analyze    # Prompts for topic selection
```

## Analysis Topics

| Topic            | What It Checks                                                            |
| ---------------- | ------------------------------------------------------------------------- |
| `architecture`   | Clean architecture, SOLID principles, layering, module organization       |
| `security`       | Authentication, authorization, input validation, secrets, OWASP Top 10    |
| `error-handling` | Error boundaries, recovery patterns, logging, user feedback               |
| `local-first`    | Offline storage, sync mechanisms, conflict resolution, optimistic updates |

## Output

Reports are saved to `packages/docs/audits/` with:

- Summary of findings
- Specific file:line references
- Prioritized recommendations
- Code examples of good and problematic patterns

## Adding New Analysis Topics

1. Create a new skill directory: `skills/your-topic/`
2. Add `SKILL.md` with:
   - Analysis criteria and what to check
   - Warning signs and good patterns
   - Report structure template
3. Update agents if needed to reference the new skill

## Components

```
codebase-analysis/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── agents/
│   ├── codebase-analyzer.md  # Single-repo analysis
│   └── repo-comparator.md    # Compare two repos
├── commands/
│   └── analyze.md            # /analyze command
└── skills/
    ├── architecture-patterns/
    ├── security-patterns/
    ├── error-handling/
    └── local-first-patterns/
```
