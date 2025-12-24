import { describe, it, expect } from 'vitest';

const ZAG_DOCS_URL = 'https://zagjs.com/llms-solid.txt';

describe('zag tool', () => {
  it('should fetch zag docs from remote URL', async () => {
    const response = await fetch(ZAG_DOCS_URL);
    expect(response.ok).toBe(true);

    const text = await response.text();
    expect(text.length).toBeGreaterThan(1000);
  });

  it('should contain ## Resources markers for parsing', async () => {
    const response = await fetch(ZAG_DOCS_URL);
    const text = await response.text();

    expect(text).toContain('## Resources');
  });

  it('should contain @zag-js package references', async () => {
    const response = await fetch(ZAG_DOCS_URL);
    const text = await response.text();

    expect(text).toContain('@zag-js/accordion');
    expect(text).toContain('@zag-js/dialog');
    expect(text).toContain('@zag-js/tooltip');
  });

  it('should contain SolidJS-specific examples', async () => {
    const response = await fetch(ZAG_DOCS_URL);
    const text = await response.text();

    expect(text).toContain('@zag-js/solid');
    expect(text).toContain('useMachine');
  });
});
