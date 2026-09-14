// portless runs the dev server with detached:true, so vite and workerd live in a
// session with no controlling TTY. If portless ever loses the terminal's foreground
// process group (orphaned parent, closed tab), Ctrl+C reaches the shell instead of
// portless and the whole tree survives. Reap any such leftovers before starting.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function ps() {
  return execFileSync('ps', ['-eo', 'pid=,pgid=,command='])
    .toString()
    .split('\n')
    .map(line => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map(([, pid, pgid, command]) => ({ pid: Number(pid), pgid: Number(pgid), command }));
}

function cwdOf(pid) {
  try {
    const out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    return (
      out
        .split('\n')
        .find(line => line.startsWith('n'))
        ?.slice(1) ?? null
    );
  } catch {
    return null;
  }
}

// Subcommands that manage the shared proxy rather than run a dev server; killing
// those would take down every other project's routing too.
const PORTLESS_MANAGEMENT =
  /portless\s+(proxy|service|prune|list|doctor|clean|hosts|alias|get|trust)\b/;

function isStaleDevProcess({ command, pid }) {
  if (/\bportless\b/.test(command) && !PORTLESS_MANAGEMENT.test(command)) {
    return cwdOf(pid)?.startsWith(repoRoot) ?? false;
  }
  return command.includes(repoRoot) && /\/vite\/bin\/vite\.js|\/workerd\b/.test(command);
}

const ownPgid = Number(execFileSync('ps', ['-o', 'pgid=', '-p', String(process.pid)]).toString());
const victims = ps().filter(p => p.pgid !== ownPgid && isStaleDevProcess(p));

if (victims.length > 0) {
  const groups = [...new Set(victims.map(p => p.pgid))];
  console.log(`Reaping ${victims.length} stale dev process(es) from a previous run`);

  // portless tears its own tree down cleanly on SIGINT, so ask nicely first.
  for (const group of groups) {
    try {
      process.kill(-group, 'SIGINT');
    } catch {}
  }

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && ps().some(p => groups.includes(p.pgid))) {
    execFileSync('sleep', ['0.2']);
  }

  for (const group of groups) {
    try {
      process.kill(-group, 'SIGKILL');
    } catch {}
  }
}
