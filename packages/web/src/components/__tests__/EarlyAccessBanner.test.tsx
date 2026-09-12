// @vitest-environment jsdom
/**
 * Pins the hydration contract behind Sentry CORATES-WEB-C: with a cached user
 * in the store, the banner must still render the server's logged-out markup
 * (a link) until the router reports hydration, then switch to the button.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import EarlyAccessBanner from '../EarlyAccessBanner';

const hydrated = vi.hoisted(() => ({ value: false }));
const auth = vi.hoisted(() => ({ loggedIn: true }));

vi.mock('@tanstack/react-router', () => ({
  useHydrated: () => hydrated.value,
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof auth) => unknown) => selector(auth),
  selectIsLoggedIn: (s: typeof auth) => s.loggedIn,
}));

describe('EarlyAccessBanner', () => {
  beforeEach(() => {
    auth.loggedIn = true;
  });

  it('renders the contact link before hydration even when the store has a cached user', () => {
    hydrated.value = false;
    render(<EarlyAccessBanner />);
    const link = screen.getByRole('link', { name: 'welcome your feedback' });
    expect(link).toHaveAttribute('href', '/contact');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the feedback button once hydrated for a logged-in user', () => {
    hydrated.value = true;
    render(<EarlyAccessBanner />);
    expect(screen.getByRole('button', { name: 'welcome your feedback' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders the contact link once hydrated for a logged-out user', () => {
    hydrated.value = true;
    auth.loggedIn = false;
    render(<EarlyAccessBanner />);
    expect(screen.getByRole('link', { name: 'welcome your feedback' })).toHaveAttribute(
      'href',
      '/contact',
    );
  });
});
