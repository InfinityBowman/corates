---
name: activity-check
description: Periodic CoRATES activity and health check - who signed up, who is active and on which projects, billing, feedback, errors, crashes, backups and email delivery since the last check, with anything odd traced to the code. Use when Jacob asks what has happened on CoRATES, for an activity/analytics/observability/usage check, or how users are doing.
---

# Activity check

Read-only. Builds on the `prod-data` skill for access details. Times in the report are Central (`America/Chicago`); Loki and D1 are UTC.

## 1. Find the window

The window starts where the last check ended. Find that check in the session transcripts (not T3 threads):

```bash
grep -lis "Activity check:" ~/.claude*/projects/*corates*/*.jsonl | xargs ls -t | head -3
```

Read the newest one's final report for its window end and its open items. If none is found, ask Jacob for a start date. Scratch dir `SP` = your scratchpad.

## 2. Gather

Run these in parallel.

**Logs** (about 700 events per day, so a month is about 20k):

```bash
python3 .claude/skills/activity-check/activity.py pull 2026-11-15T14:00:00 "$SP"
```

**D1** (from `packages/web`; `S` = window start as unix seconds):

```bash
j(){ npx wrangler d1 execute corates-db-prod --remote --env production --json --command "$1" 2>/dev/null; }
q(){ j "$1" | python3 -c "import json,sys
for r in json.load(sys.stdin)[0]['results']: print(' | '.join(str(v) for v in r.values()))"; }
j "select id,name,email,institution,createdAt from user" | python3 -c "import json,sys; json.dump(json.load(sys.stdin)[0]['results'],open('$SP/users.json','w'))"
j "select id,name,createdAt from projects" | python3 -c "import json,sys; json.dump(json.load(sys.stdin)[0]['results'],open('$SP/projects.json','w'))"
q "select count(*) from user"; q "select count(*) from projects"
q "select name,email,institution,title,persona,datetime(createdAt,'unixepoch'),datetime(profileCompletedAt,'unixepoch') from user where createdAt > $S order by createdAt"
q "select p.name,datetime(p.createdAt,'unixepoch'),(select group_concat(u.name||':'||pm.role,', ') from project_members pm join user u on u.id=pm.userId where pm.projectId=p.id) from projects p where p.createdAt > $S order by p.createdAt"
q "select pi.email,p.name,datetime(pi.createdAt,'unixepoch'),datetime(pi.acceptedAt,'unixepoch') from project_invitations pi join projects p on p.id=pi.projectId where pi.createdAt > $S order by pi.createdAt"
q "select f.category,u.name,datetime(f.createdAt,'unixepoch'),f.status,replace(f.message,char(10),' ') from feedback f left join user u on u.id=f.userId where f.createdAt > $S"
q "select s.plan,s.status,o.name,datetime(s.periodStart,'unixepoch'),datetime(s.periodEnd,'unixepoch'),s.stripeSubscriptionId is not null from subscription s left join organization o on o.id=s.referenceId"
```

A subscription without a `stripeSubscriptionId` is an admin grant, not a customer. `user.lastActiveAt` is not maintained; use the logs for activity. Deleted projects leave D1 entirely (their final copy is under `deleted/` in R2).

**Deploys, commits, Sentry**:

```bash
git fetch -q origin main && git log --format='%cd %h %s' --date=format:'%m-%d %H:%M' --since=<start> origin/main
npx wrangler deployments list --env production | grep -E "Created|Version" | tail -12
TOKEN=$(grep -m1 token ~/.sentryclirc | sed 's/^[^=]*= *//')
curl -s -G -H "Authorization: Bearer $TOKEN" https://sentry.io/api/0/projects/corates/corates-web/issues/ \
  --data-urlencode statsPeriod=14d --data-urlencode "query=lastSeen:>$START_ISO"
# per issue: https://sentry.io/api/0/organizations/corates/issues/<shortId>/events/latest/ (stack, breadcrumbs, release)
```

Then: `python3 .claude/skills/activity-check/activity.py summary "$SP"`.

## 3. Read it

- **Usage**: new users (vs total), distinct active users and the daily curve, new projects and who joined them, which projects did the most work, free local appraisals, resource-page CTA clicks.
- **Every Sentry issue and `client.crash`**: open the latest event, then find the cause in the code. `client.crash` is logged for every Sentry event, handled ones too, so check `handled` before calling it a crash. React #418 on `/resources/*` is the known hydration error.
- **Feedback rows**: reproduce from the code; check in the logs whether the user got past it or left.
- **Server errors**: `HTTPError` / `status >= 500`. Find the route with a narrow Loki query around the timestamp (see the `prod-data` skill), since trace ids are often missing.
- **Auth friction**: a user created but never completing a profile, `oauth_error_redirect`, repeated `sign_in_failed`, `accepted_with_different_email` (the person now has two accounts).
- **Duplicate accounts**: same name or person with several emails, `sync.authorize_denied not-a-member` on their own project. Probably dodging the free project limit.
- **Billing**: new or canceled subscriptions, `billing.*` failures.
- **Email**: `email.sent` by `provider` (cloudflare, or postmark as the fallback) and any `email.failed`.
- **Backups**: `backup.completed` should log once a day at 05:00 UTC. Missing lines usually mean a log-export gap (the summary lists empty hours), so confirm in R2 before calling it a failure:
  `npx wrangler r2 object get "corates-backups-prod/snapshots/<projectId>/<YYYY-MM-DD>.json.gz" --remote --pipe | wc -c`
- **Last check's open items and fixes shipped since**: did each bug stop recurring, did the stuck user come back.

Verify every bug claim against the code before reporting it. Do not fix anything during the check; offer the fixes at the end.

## 4. Report

Start the reply with `Activity check:` and the exact window in Central time, so the next check can find it. Then, in plain sentences:

1. Headline numbers (new and total users, active users, new projects, deploys in the window).
2. Bugs confirmed in the code: what the user hit, the cause with `file:line`, who else it affects.
3. Worth knowing: usage patterns, notable users or teams, duplicate accounts, billing, email and backup health, follow-ups from last time.
4. Suggested fixes or changes, for Jacob to pick from.

Use names as they appear in the app.
