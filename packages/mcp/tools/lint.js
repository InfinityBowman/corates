import { z } from 'zod';
import { exec as execCallback } from 'child_process';
import { util } from 'util';

const exec = util.promisify(execCallback);

export function registerLintTools(server, repoRoot) {
  server.tool(
    'run_lint',
    'Run pnpm lint from the repository root. Set fix=true to apply autofixes.',
    {
      fix: z.boolean().optional().default(false).describe('Whether to run lint with --fix'),
    },
    async ({ fix = false }) => {
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
        const stdout = error.stdout || '';
        const stderr = error.stderr || error.message || '';
        const output =
          [stdout, stderr].filter(Boolean).join('\n').trim() || 'Lint failed with no output';
        return {
          content: [
            {
              type: 'text',
              text: `Command: ${command}\nExit code: ${error.code ?? 'unknown'}\n\n${output}`,
            },
          ],
        };
      }
    },
  );
}
