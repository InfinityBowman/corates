import { z } from 'zod';
import { exec as execCallback } from 'child_process';
import util from 'util';
import type { McpServerType } from '../types.js';

const exec = util.promisify(execCallback);

interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  code?: number | string;
}

export function registerLintTools(server: McpServerType, repoRoot: string): void {
  server.tool(
    'run_lint',
    'Run pnpm lint from the repository root. Set fix=true to apply autofixes.',
    {
      fix: z.boolean().optional().default(false).describe('Whether to run lint with --fix'),
    },
    async ({ fix = false }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const command = `pnpm run lint${fix ? ' --fix' : ''}`;

      try {
        const { stdout, stderr } = await exec(command, {
          cwd: repoRoot,
          maxBuffer: 4 * 1024 * 1024,
        });
        const output =
          [stdout, stderr].filter(Boolean).join('\n').trim() || 'Lint completed with no output';
        return {
          content: [{ type: 'text', text: `Command: ${command}\n\n${output}` }],
        };
      } catch (error) {
        const execError = error as ExecError;
        const stdout = execError.stdout || '';
        const stderr = execError.stderr || execError.message || '';
        const output =
          [stdout, stderr].filter(Boolean).join('\n').trim() || 'Lint failed with no output';
        return {
          content: [
            {
              type: 'text',
              text: `Command: ${command}\nExit code: ${execError.code ?? 'unknown'}\n\n${output}`,
            },
          ],
        };
      }
    },
  );
}
