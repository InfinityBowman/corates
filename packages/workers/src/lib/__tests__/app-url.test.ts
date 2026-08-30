import { describe, expect, it } from 'vitest';
import { buildAppUrl, getAppBasepath } from '../app-url';
import type { Env } from '../../types';

function env(overrides: Record<string, string | undefined> = {}): Env {
  return {
    APP_URL: 'https://corates.org',
    ...overrides,
  } as Env;
}

describe('getAppBasepath', () => {
  it('returns empty string for root basepath', () => {
    expect(getAppBasepath(env({ BASEPATH: '/' }))).toBe('');
    expect(getAppBasepath(env({ BASEPATH: '' }))).toBe('');
  });

  it('normalizes trailing slash', () => {
    expect(getAppBasepath(env({ BASEPATH: '/app/' }))).toBe('/app');
  });

  it('falls back to VITE_BASEPATH', () => {
    expect(getAppBasepath(env({ VITE_BASEPATH: '/preview' }))).toBe('/preview');
  });

  it('prefers BASEPATH over VITE_BASEPATH', () => {
    expect(getAppBasepath(env({ BASEPATH: '/worker', VITE_BASEPATH: '/client' }))).toBe('/worker');
  });
});

describe('buildAppUrl', () => {
  it('builds root deployment URLs', () => {
    expect(buildAppUrl(env(), '/invite/abc')).toBe('https://corates.org/invite/abc');
    expect(buildAppUrl(env(), '/projects/p1')).toBe('https://corates.org/projects/p1');
  });

  it('includes basepath when configured', () => {
    expect(buildAppUrl(env({ BASEPATH: '/app' }), '/invite/abc')).toBe(
      'https://corates.org/app/invite/abc',
    );
  });

  it('strips trailing slash from APP_URL', () => {
    expect(buildAppUrl(env({ APP_URL: 'https://corates.org/' }), '/dashboard')).toBe(
      'https://corates.org/dashboard',
    );
  });
});
