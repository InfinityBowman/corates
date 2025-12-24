import { describe, it, expect } from 'vitest';

const DRIZZLE_DOCS_URL = 'https://orm.drizzle.team/llms-full.txt';

describe('drizzle tool', () => {
  it('should fetch drizzle docs from remote URL', async () => {
    const response = await fetch(DRIZZLE_DOCS_URL);
    expect(response.ok).toBe(true);

    const text = await response.text();
    expect(text.length).toBeGreaterThan(1000);
  });

  it('should contain Source: markers for parsing', async () => {
    const response = await fetch(DRIZZLE_DOCS_URL);
    const text = await response.text();

    expect(text).toContain('Source: https://orm.drizzle.team/docs/');
  });

  it('should contain common documentation topics', async () => {
    const response = await fetch(DRIZZLE_DOCS_URL);
    const text = await response.text();

    // Check for common doc paths
    expect(text).toContain('/docs/select');
    expect(text).toContain('/docs/insert');
    expect(text).toContain('/docs/update');
    expect(text).toContain('/docs/delete');
  });
});
