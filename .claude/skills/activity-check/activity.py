#!/usr/bin/env python3
"""Pull and summarize CoRATES production log events for an activity check.

  python3 activity.py pull <start-utc-iso> <out-dir> [end-utc-iso]
  python3 activity.py summary <out-dir>     # needs users.json + projects.json from D1 in <out-dir>

`pull` writes <out-dir>/raw.json as [ts_ns, stream_labels, line] rows.
"""

import collections
import datetime
import json
import subprocess
import sys
from zoneinfo import ZoneInfo

CT = ZoneInfo('America/Chicago')
UTC = datetime.UTC
# request.completed and websocket chatter are ~90% of volume and carry no user intent.
QUERY = (
    '{deployment_environment_name="production"} | json | __error__="" '
    '| message != "request.completed" | message !~ "user-session websocket.*"'
)
NOTABLE = {
    'client.crash', 'client.sync.fatal', 'HTTPError', 'client.auth.oauth_error_redirect',
    'client.auth.sign_in_failed', 'client.translation_guard', 'client.pdf.load_failed',
    'client.pdf.upload_failed', 'sync.authorize_denied', 'auth.code_rejected',
    'auth.onboarding_code_rejected', 'auth.onboarding_account_claimed', 'auth.user_created',
    'project.deleted', 'invitation.accepted_with_different_email', 'invitation.cancelled',
    'billing.subscription_synced', 'feedback.submitted', 'backup.completed', 'backup.failed',
    'backup.deleted_snapshot', 'email.sent', 'email.failed',
}
KEYS = [
    'userId', 'to', 'subject', 'provider', 'errorMessage', 'error', 'code', 'reason', 'route',
    'status', 'plan', 'component', 'projectId', 'orgId', 'stage',
]
ACTIVITY = {
    'client.checklist.completed', 'client.checklist.created', 'client.appraisal.created',
    'client.appraisal.deleted', 'client.reconciliation.finalized', 'client.project.exported',
    'pdf.uploaded', 'client.collaborator.invited', 'client.checklist.sent_back_to_todo',
    'sync.mutation',
}


def loki_ip():
    return subprocess.run(
        ['docker', '--context', 'homelab', 'inspect', 'corates-loki', '-f',
         '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def pull(start, out, end=None):
    ip = loki_ip()
    t = datetime.datetime.fromisoformat(start).replace(tzinfo=UTC)
    end = datetime.datetime.fromisoformat(end).replace(tzinfo=UTC) if end else datetime.datetime.now(UTC)
    rows = []
    while t < end:
        t2 = min(t + datetime.timedelta(hours=6), end)
        cmd = (
            f"curl -s -G http://{ip}:3100/loki/api/v1/query_range --data-urlencode 'query={QUERY}' "
            f"--data-urlencode start={t:%Y-%m-%dT%H:%M:%SZ} --data-urlencode end={t2:%Y-%m-%dT%H:%M:%SZ} "
            "--data-urlencode limit=5000 --data-urlencode direction=forward"
        )
        res = subprocess.run(['ssh', 'jacob@homelab', cmd], capture_output=True, text=True, timeout=120)
        try:
            streams = json.loads(res.stdout)['data']['result']
        except Exception:
            print('ERR', t, res.stdout[:200])
            t = t2
            continue
        n = 0
        for s in streams:
            for ts, line in s['values']:
                rows.append([int(ts), s['stream'], line])
                n += 1
        if n >= 5000:
            print(t.isoformat(), 'TRUNCATED: shrink the 6h step')
        t = t2
    json.dump(rows, open(f'{out}/raw.json', 'w'))
    print(len(rows), 'events')


def summary(out):
    raw = json.load(open(f'{out}/raw.json'))
    users = {u['id']: u for u in json.load(open(f'{out}/users.json'))}
    projects = {p['id']: p['name'] for p in json.load(open(f'{out}/projects.json'))}

    def nm(uid):
        return (users.get(uid, {}).get('name') or uid or 'anon')[:28]

    def ct(ts, fmt='%a %m-%d %H:%M'):
        return datetime.datetime.fromtimestamp(ts / 1e9, CT).strftime(fmt)

    rows = []
    for ts, st, line in raw:
        try:
            rows.append((ts, st, json.loads(line)))
        except ValueError:
            pass
    rows.sort(key=lambda r: r[0])

    print('== event counts')
    for m, n in collections.Counter(j.get('message', '') for _, _, j in rows).most_common(60):
        print(f'  {n:6} {m[:110]}')
    vers = collections.Counter((st.get('cloudflare_script_version_id') or '?')[:8] for _, st, _ in rows)
    print('== worker versions seen', vers.most_common())

    print('== empty UTC hours (log export gaps; the crons log at 05 and 06 every day)')
    hours = collections.Counter(datetime.datetime.fromtimestamp(ts / 1e9, UTC).strftime('%m-%d %H') for ts, _, _ in rows)
    t = datetime.datetime.fromtimestamp(rows[0][0] / 1e9, UTC).replace(minute=0, second=0, microsecond=0)
    last = datetime.datetime.fromtimestamp(rows[-1][0] / 1e9, UTC)
    empty = []
    while t < last:
        if hours[t.strftime('%m-%d %H')] == 0:
            empty.append(t.strftime('%m-%d %H'))
        t += datetime.timedelta(hours=1)
    print(' ', ' '.join(empty) or 'none')

    print('== active users')
    daily = collections.defaultdict(set)
    for ts, _, j in rows:
        if j.get('userId') and j.get('message') in ('auth.session_created', 'sync.mutation', 'sync.authorize_ok'):
            daily[ct(ts, '%m-%d')].add(j['userId'])
    print('  distinct', len(set().union(*daily.values()) if daily else set()))
    print('  daily', {k: len(v) for k, v in sorted(daily.items())})

    print('== notable events (Central time)')
    for ts, st, j in rows:
        m = j.get('message', '')
        if m in NOTABLE or 'ERROR' in m:
            d = {**st, **j}
            o = {k: str(d[k])[:160] for k in KEYS if d.get(k) not in (None, '')}
            if 'userId' in o:
                o['userId'] = nm(d['userId'])
            if 'projectId' in o:
                o['projectId'] = projects.get(d['projectId'], d['projectId'][:8])
            print(' ', ct(ts), m[:80], o)

    print('== per-project activity')
    proj = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
    days = collections.defaultdict(set)
    for ts, _, j in rows:
        m, pid, r = j.get('message'), j.get('projectId'), j.get('route') or ''
        if not pid and '/projects/' in r:
            pid = r.split('/projects/')[1].split('/')[0]
        if m in ACTIVITY and pid:
            key = m.replace('client.', '')
            if m in ('client.checklist.completed', 'client.checklist.created'):
                key += ':' + str(j.get('type') or j.get('checklistType'))
            proj[pid][nm(j.get('userId'))][key] += 1
            days[pid].add(ct(ts, '%m-%d'))
    for pid, d in sorted(proj.items(), key=lambda x: -sum(sum(c.values()) for c in x[1].values())):
        print(' ##', projects.get(pid, pid + ' (deleted?)'), '| days', ' '.join(sorted(days[pid])))
        for u, c in d.items():
            c = dict(c)
            print('    ', u, 'mutations', c.pop('sync.mutation', 0), c)

    print('== free (local) appraisals, no account needed')
    loc = collections.defaultdict(collections.Counter)
    for _, st, j in rows:
        m = j.get('message', '')
        if m.startswith('client.local_appraisal'):
            who = nm(j['userId']) if j.get('userId') else 'anon'
            loc[who][m.split('.')[-1]] += 1
    for k, v in sorted(loc.items(), key=lambda x: -x[1]['created']):
        print('   ', k, dict(v))


if __name__ == '__main__':
    if sys.argv[1] == 'pull':
        pull(*sys.argv[2:])
    else:
        summary(sys.argv[2])
