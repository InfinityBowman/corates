/**
 * Code Review Tool
 * Provides structured code review of git changes with project-specific criteria
 */

import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Files to exclude from review (binary, generated, lock files)
const IGNORED_EXTENSIONS = [
  '.txt',
  '.lock',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
];
const IGNORED_FILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];

// Strict branch name validation (alphanumeric, dots, slashes, hyphens, underscores)
const BRANCH_NAME_REGEX = /^[A-Za-z0-9._/-]+$/;

function isValidBranchName(name) {
  return BRANCH_NAME_REGEX.test(name) && name.length < 256;
}

function filterFiles(files) {
  return files
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter(f => {
      const lower = f.toLowerCase();
      if (IGNORED_FILES.some(ignored => lower.endsWith(ignored))) return false;
      if (IGNORED_EXTENSIONS.some(ext => lower.endsWith(ext))) return false;
      return true;
    })
    .join('\n');
}

export function registerCodeReviewTools(server, repoRoot) {
  server.tool(
    'code_review',
    'Get a structured code review of current git changes or branch diff. Returns the diff with project-specific review criteria for CoRATES (SolidJS + Cloudflare Workers).',
    {
      base: z.string().optional().describe('Base branch to compare against (default: main)'),
      staged: z.boolean().optional().describe('Review only staged changes instead of branch diff'),
      filesOnly: z
        .boolean()
        .optional()
        .describe('Return only the list of changed files without full diff'),
    },
    async ({ base = 'main', staged = true, filesOnly = false }) => {
      try {
        // Validate branch name to prevent command injection
        if (!staged && !isValidBranchName(base)) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Invalid branch name '${base}'. Branch names must be alphanumeric with dots, slashes, hyphens, or underscores.`,
              },
            ],
          };
        }

        // Get changed file list using execFile (no shell interpolation)
        const filesArgs =
          staged ? ['diff', '--staged', '--name-only'] : ['diff', `${base}...HEAD`, '--name-only'];

        const { stdout: rawFiles } = await execFileAsync('git', filesArgs, {
          cwd: repoRoot,
          maxBuffer: 1024 * 1024,
        });

        // Filter out ignored files
        const files = filterFiles(rawFiles);

        if (!files.trim()) {
          // Fall back to unstaged changes if no branch diff
          const { stdout: rawUnstagedFiles } = await execFileAsync('git', ['diff', '--name-only'], {
            cwd: repoRoot,
          });

          const unstagedFiles = filterFiles(rawUnstagedFiles);

          if (!unstagedFiles.trim()) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No changes to review. Make sure you have uncommitted changes or commits ahead of the base branch.',
                },
              ],
            };
          }

          // Use unstaged diff instead (with pathspec to exclude ignored files)
          const { stdout: diff } = await execFileAsync(
            'git',
            ['diff', '--', ...unstagedFiles.trim().split('\n')],
            {
              cwd: repoRoot,
              maxBuffer: 1024 * 1024 * 5,
            },
          );

          return {
            content: [
              {
                type: 'text',
                text: buildReviewPrompt(unstagedFiles, filesOnly ? null : diff, 'unstaged'),
              },
            ],
          };
        }

        if (filesOnly) {
          return {
            content: [
              {
                type: 'text',
                text: buildReviewPrompt(files, null, staged ? 'staged' : base),
              },
            ],
          };
        }

        // Get the full diff using execFile (no shell) with pathspec to filter files
        const fileList = files.trim().split('\n').filter(Boolean);
        const diffArgs =
          staged ?
            ['diff', '--staged', '--', ...fileList]
          : ['diff', `${base}...HEAD`, '--', ...fileList];

        const { stdout: diff } = await execFileAsync('git', diffArgs, {
          cwd: repoRoot,
          maxBuffer: 1024 * 1024 * 5, // 5MB buffer for large diffs
        });

        return {
          content: [
            {
              type: 'text',
              text: buildReviewPrompt(files, diff, staged ? 'staged' : base),
            },
          ],
        };
      } catch (error) {
        // Handle case where base branch doesn't exist or other git errors
        const errMsg = error.message || error.stderr || '';
        if (errMsg.includes('unknown revision') || errMsg.includes('bad revision')) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Branch '${base}' not found. Try specifying a different base branch.`,
              },
            ],
          };
        }
        // Return sanitized error (avoid leaking internal paths)
        return {
          content: [
            {
              type: 'text',
              text: 'Error running git command. Check that you have staged changes and the repository is valid.',
            },
          ],
        };
      }
    },
  );
}

function buildReviewPrompt(files, diff, compareTarget) {
  const fileList = files
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(f => `- ${f}`)
    .join('\n');

  const header = `# Code Review Request

**Comparing:** ${
    compareTarget === 'staged' ? 'Staged changes'
    : compareTarget === 'unstaged' ? 'Unstaged changes'
    : `Current branch vs ${compareTarget}`
  }

**Files Changed (${files.trim().split('\n').filter(Boolean).length}):**
${fileList}
`;

  const reviewPrompt = `
 You are a senior code reviewer for the CoRATES project.

Your role is to act like a senior engineer reviewing a production, data-sensitive system.
You are NOT a stylistic reviewer. You are a correctness, safety, and maintainability gate.

## Project Context (Authoritative)

CoRATES is:
- A **local-first, collaborative research application**
- Data correctness and validation are critical

## Technology Stack (Hard Constraints)

- SolidJS (UI framework)
- Zag.js components (components/zag/)
- Drizzle ORM (ALL database access)
- Zod (ALL external input validation)
- solid-icons (NO emoji characters)

## Severity Definitions (USE THESE)

### 🔴 CRITICAL
Issues that can:
- Corrupt or invalidate data
- Introduce security vulnerabilities
- Cause crashes or unrecoverable failures
- Break core workflows or collaboration

### 🟠 MODERATE
Issues that:
- Are likely to cause bugs over time
- Increase maintenance burden
- Create architectural debt
- Hurt performance in realistic usage
- Make behavior difficult to reason about

### 🟡 LOW
Issues that:
- Reduce clarity or consistency
- Suggest missing abstractions
- Improve future maintainability
- Are safe to defer

## Issue Detection Focus

### Data & Validation
- Missing or unenforced Zod schemas
- Schema drift between layers
- Implicit trust in client data
- Edge cases not validated

### Database & State
- Database access not using Drizzle
- N+1 query patterns
- State inconsistencies or race conditions
- Logic relying on undocumented invariants

### Async & Failure Modes
- Async logic without explicit error handling
- Errors that are swallowed or ignored
- Missing fallback UI for likely failures
- Fire-and-forget async that affects user state

### Security & Trust Boundaries
- Exposed secrets or credentials
- XSS risks from user-generated content
- Client-side permission enforcement
- Auth logic leaking into UI components

### Architecture & Design
- Business logic inside UI components
- Tight coupling between UI and persistence
- Hardcoded configuration values
- Components coordinating multiple unrelated concerns

### Performance & Resource Safety
- Expensive operations tied to render paths
- Missing cleanup for subscriptions/listeners
- Repeated work that should be cached or memoized


## Output Format (STRICT)

### 🔴 CRITICAL ISSUES
[Important and dangerous]

**[Category] in path/to/file.ts:LINE**
- Problem:
- Impact:
- AI prompt for fix:

---

### 🟠 MODERATE ISSUES
[Important but not immediately dangerous]

**[Category] in path/to/file.ts:LINE**
- Problem:
- Impact:
- AI prompt for fix:

---

### 🟡 LOW ISSUES
[Cleanups and improvements]

**[Category] in path/to/file.ts:LINE**
- Problem:
- AI prompt for fix:

---

BE AGGRESSIVE.
BE PRECISE.
BE CONSERVATIVE WITH CRITICAL.
BE WILLING TO FLAG AMBIGUITY.

Your job is to surface risk, not to be polite.
`;

  if (!diff) {
    return `${header}
${reviewPrompt}

_Diff not included. Use \`filesOnly: false\` to include full diff._
`;
  }

  return `${header}
${reviewPrompt}

## Diff

\`\`\`diff
${diff}
\`\`\`
`;
}
