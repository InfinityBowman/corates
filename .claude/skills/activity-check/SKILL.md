---
name: activity-check
description: This skill should be used when Jacob asks what has happened on CoRATES, how users are doing, or for an activity, usage, analytics or observability check since the last one.
---

# Activity check

Tell Jacob what happened on CoRATES since the last check: who showed up, what they did, where they got stuck, and anything broken. Read-only; access to logs, the database, Sentry and the rest is in the `prod-data` skill, and what each log event means is in `packages/docs/guides/observability.md`.

Pick up where the last check left off. Previous checks are Claude Code sessions, not T3 threads; their reports start with `Activity check:` and the window, so `grep -l "Activity check:" ~/.claude*/projects/*corates*/*.jsonl` finds them. Read the newest report for its end time and anything it left open. Start this report the same way so the next check can find it.

Trace anything that looks wrong into the code and confirm it before calling it a bug. Check a gap in the logs against the source of truth before reporting a failure (logs can drop lines). Report in plain sentences, times in Central, names as they appear in the app, and offer fixes rather than making them.
