import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStaleChunkError, reloadOnceForStaleChunk } from '../staleChunk.js';

describe('isStaleChunkError', () => {
  it('matches the browser and Vite messages for a missing chunk', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://corates.org/assets/_app-CtK-D75M.js',
      'error loading dynamically imported module: https://corates.org/assets/x.js',
      'Importing a module script failed.',
      'Unable to preload CSS for /assets/styles-B601eIHN.css',
    ]) {
      expect(isStaleChunkError(new Error(message))).toBe(true);
    }
  });

  it('ignores other errors', () => {
    expect(isStaleChunkError(new Error('Network request failed'))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
    expect(isStaleChunkError('Failed to fetch dynamically imported module')).toBe(false);
  });
});

describe('reloadOnceForStaleChunk', () => {
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });

  afterEach(() => {
    reload.mockClear();
    sessionStorage.clear();
  });

  it('reloads the first time a chunk fails and not again for the same chunk', () => {
    const error = new Error('Failed to fetch dynamically imported module: /assets/a.js');
    expect(reloadOnceForStaleChunk(error)).toBe(true);
    expect(reloadOnceForStaleChunk(error)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  // vite:preloadError also fires when a lazily loaded module throws while evaluating
  it('does not reload for an error that is not a missing chunk', () => {
    expect(reloadOnceForStaleChunk(new Error('boom during module evaluation'))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('keys the guard on the failing chunk', () => {
    reloadOnceForStaleChunk(new Error('Failed to fetch dynamically imported module: /assets/a.js'));
    expect(
      reloadOnceForStaleChunk(
        new Error('Failed to fetch dynamically imported module: /assets/b.js'),
      ),
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
