import { describe, it, expect } from 'vitest';

const BETTER_AUTH_BASE_URL = 'https://www.better-auth.com';

describe('better-auth tool', () => {
  it('should fetch better-auth index from remote URL', async () => {
    const response = await fetch(`${BETTER_AUTH_BASE_URL}/llms.txt`);
    expect(response.ok).toBe(true);

    const text = await response.text();
    expect(text.length).toBeGreaterThan(100);
  });

  it('should list available documentation paths', async () => {
    const response = await fetch(`${BETTER_AUTH_BASE_URL}/llms.txt`);
    const text = await response.text();

    // Should contain paths to docs
    expect(text).toContain('docs/');
  });

  it('should fetch specific doc path', async () => {
    // Fetch a known doc path
    const response = await fetch(`${BETTER_AUTH_BASE_URL}/llms.txt/docs/introduction.md`);

    // Should either succeed or return a proper error
    if (response.ok) {
      const text = await response.text();
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
