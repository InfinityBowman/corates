import { Show, For, createSignal } from 'solid-js';
import { FiMenu, FiX } from 'solid-icons/fi';
import { urls } from '~/lib/config';
import { useAuth } from '~/lib/auth';
import PrefetchLink from '~/components/PrefetchLink';

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
        class='sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100'
        aria-label='Primary'
      >
        <div class='flex items-center justify-between w-full mx-auto px-6 py-4'>
          <div class='flex items-center gap-8'>
            <PrefetchLink
              href='/'
              class='inline-flex items-center gap-2 text-xl font-bold text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded'
            >
              <img
                src='/icon.png'
                alt=''
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
                  class='hidden sm:inline-flex text-gray-600 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded'
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
                    class='hidden sm:inline-flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'
                  >
                    Sign In
                  </a>
                  <a
                    href={urls.signUp()}
                    rel='external'
                    class='hidden sm:inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'
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
                  class='hidden sm:inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'
                >
                  My Dashboard
                </a>
              </>
            </Show>

            {/* Mobile Menu Button */}
            <button
              type='button'
              class='sm:hidden inline-flex items-center justify-center p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600'
              onClick={toggleMobileMenu}
              aria-expanded={mobileMenuOpen()}
              aria-controls='mobile-menu'
              aria-label={mobileMenuOpen() ? 'Close menu' : 'Open menu'}
            >
              <Show when={mobileMenuOpen()} fallback={<FiMenu class='w-6 h-6' />}>
                <FiX class='w-6 h-6' />
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
        class='sm:hidden fixed inset-0 z-40 bg-gray-900/20 backdrop-blur-sm animate-backdrop-fade'
        onClick={() => props.onClose()}
        aria-hidden='true'
      />

      {/* Menu panel */}
      <div
        id='mobile-menu'
        class='sm:hidden fixed top-16 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-lg animate-slide-down'
      >
        <div class='px-6 py-6 space-y-1'>
          <For each={props.navLinks}>
            {(link, index) => (
              <PrefetchLink
                href={link.href}
                class='block text-lg text-gray-700 hover:text-blue-600 hover:bg-blue-50 py-3 px-3 -mx-3 rounded-lg transition-colors animate-stagger-item'
                style={{ 'animation-delay': getDelay(index()) }}
                onClick={() => props.onClose()}
              >
                {link.label}
              </PrefetchLink>
            )}
          </For>
          <div
            class='pt-4 mt-4 border-t border-gray-200 space-y-3 animate-stagger-item'
            style={{ 'animation-delay': getDelay(props.navLinks.length) }}
          >
            <Show
              when={isLoggedIn()}
              fallback={
                <>
                  <a
                    href={urls.signIn()}
                    rel='external'
                    class='block w-full text-center px-4 py-3 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium'
                  >
                    Sign In
                  </a>
                  <a
                    href={urls.signUp()}
                    rel='external'
                    class='block w-full text-center px-4 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium'
                  >
                    Sign Up
                  </a>
                </>
              }
            >
              <a
                href={urls.dashboard()}
                rel='external'
                class='block w-full text-center px-4 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium'
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
