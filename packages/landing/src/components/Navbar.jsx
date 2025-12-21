import { Show, For, createSignal } from 'solid-js';
import { FiMenu, FiX } from 'solid-icons/fi';
import { urls } from '~/lib/config';
import { useAuth } from '~/lib/auth';
import PrefetchLink from '~/components/PrefetchLink';
import EarlyAccessBanner from '~/components/EarlyAccessBanner';

export default function Navbar() {
  const { isLoggedIn, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen());

  const navLinks = [
    { href: '/about', label: 'About' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <>
      <nav
        class='sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm'
        aria-label='Primary'
      >
        <div class='mx-auto flex w-full items-center justify-between px-6 py-4'>
          <div class='flex items-center gap-8'>
            <PrefetchLink
              href='/'
              class='inline-flex items-center gap-2 rounded text-xl font-bold text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none'
            >
              <img
                src='/logo.svg'
                alt='CoRATES Logo'
                aria-hidden='true'
                class='h-6 w-6 rounded-sm'
                width='24'
                height='24'
              />
              CoRATES
            </PrefetchLink>
            <For each={navLinks}>
              {link => (
                <PrefetchLink
                  href={link.href}
                  class='hidden rounded text-gray-600 transition-colors hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex'
                >
                  {link.label}
                </PrefetchLink>
              )}
            </For>
          </div>
          <div class='flex items-center gap-3'>
            <Show
              when={isLoggedIn()}
              fallback={
                <>
                  <a
                    href={urls.signIn()}
                    rel='external'
                    class='hidden items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex'
                  >
                    Sign In
                  </a>
                  <a
                    href={urls.signUp()}
                    rel='external'
                    class='hidden items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex'
                  >
                    Sign Up
                  </a>
                </>
              }
            >
              <>
                <span class='hidden sm:inline-flex'>
                  Welcome back, {user()?.name || 'User'}!&nbsp;
                </span>
                <a
                  href={urls.dashboard()}
                  rel='external'
                  class='hidden items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex'
                >
                  My Dashboard
                </a>
              </>
            </Show>

            {/* Mobile Menu Button */}
            <button
              type='button'
              class='inline-flex items-center justify-center rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none sm:hidden'
              onClick={toggleMobileMenu}
              aria-expanded={mobileMenuOpen()}
              aria-controls='mobile-menu'
              aria-label={mobileMenuOpen() ? 'Close menu' : 'Open menu'}
            >
              <Show when={mobileMenuOpen()} fallback={<FiMenu class='h-6 w-6' />}>
                <FiX class='h-6 w-6' />
              </Show>
            </button>
          </div>
        </div>
      </nav>

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        navLinks={navLinks}
      />
      <EarlyAccessBanner />
    </>
  );
}

function MobileMenu(props) {
  const { isLoggedIn } = useAuth();

  // Stagger delays for menu items (in ms)
  const getDelay = index => `${50 + index * 50}ms`;

  return (
    <Show when={props.isOpen()}>
      {/* Backdrop overlay */}
      <div
        class='animate-backdrop-fade fixed inset-0 z-40 bg-gray-900/20 backdrop-blur-sm sm:hidden'
        onClick={() => props.onClose()}
        aria-hidden='true'
      />

      {/* Menu panel */}
      <div
        id='mobile-menu'
        class='animate-slide-down fixed top-16 right-0 left-0 z-50 border-b border-gray-200 bg-white/95 shadow-lg backdrop-blur-md sm:hidden'
      >
        <div class='space-y-1 px-6 py-6'>
          <For each={props.navLinks}>
            {(link, index) => (
              <PrefetchLink
                href={link.href}
                class='animate-stagger-item -mx-3 block rounded-lg px-3 py-3 text-lg text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600'
                style={{ 'animation-delay': getDelay(index()) }}
                onClick={() => props.onClose()}
              >
                {link.label}
              </PrefetchLink>
            )}
          </For>
          <div
            class='animate-stagger-item mt-4 space-y-3 border-t border-gray-200 pt-4'
            style={{ 'animation-delay': getDelay(props.navLinks.length) }}
          >
            <Show
              when={isLoggedIn()}
              fallback={
                <>
                  <a
                    href={urls.signIn()}
                    rel='external'
                    class='block w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-700 transition-colors hover:bg-gray-50'
                  >
                    Sign In
                  </a>
                  <a
                    href={urls.signUp()}
                    rel='external'
                    class='block w-full rounded-lg bg-blue-600 px-4 py-3 text-center font-medium text-white shadow-sm transition-colors hover:bg-blue-700'
                  >
                    Sign Up
                  </a>
                </>
              }
            >
              <a
                href={urls.dashboard()}
                rel='external'
                class='block w-full rounded-lg bg-blue-600 px-4 py-3 text-center font-medium text-white shadow-sm transition-colors hover:bg-blue-700'
              >
                My Dashboard
              </a>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
