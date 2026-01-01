import { Show, For, createEffect, createSignal, onMount, onCleanup } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { FiMenu, FiWifiOff, FiChevronDown, FiX } from 'solid-icons/fi';
import { LANDING_URL } from '@config/api.js';
import useOnlineStatus from '@primitives/useOnlineStatus.js';
import { Avatar } from '@corates/ui';

export default function Navbar(props) {
  const { user, signout, authLoading, isLoggedIn } = useBetterAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const [showUserMenu, setShowUserMenu] = createSignal(false);
  let userMenuRef;

  // Read from localStorage on render to avoid layout shift on refresh
  const storedName = localStorage.getItem('userName');
  const isLikelyLoggedIn = !!storedName;

  createEffect(() => {
    if (user()) {
      localStorage.setItem('userName', user().name);
    } else if (!authLoading()) {
      // Only clear when auth has finished loading and there's no user
      localStorage.removeItem('userName');
    }
  });

  // Close menus when clicking outside
  onMount(() => {
    const handleClickOutside = event => {
      if (userMenuRef && !userMenuRef.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => {
      document.removeEventListener('mousedown', handleClickOutside);
    });
  });

  const handleSignOut = async () => {
    try {
      await signout();
      // Use replace: true to avoid back button issues
      navigate('/signin', { replace: true });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };


  return (
    <nav class='sticky top-0 z-50 flex items-center justify-between bg-linear-to-r from-blue-700 to-blue-500 px-4 py-2 text-white shadow-lg'>
      <div class='flex items-center space-x-3'>
        {/* Mobile sidebar toggle button (hidden on desktop where sidebar has its own toggle) */}
        <button
          class='-ml-1.5 rounded-full border border-blue-200 bg-white/80 p-1.5 text-blue-700 shadow transition-all duration-200 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none md:hidden'
          onClick={() => props.toggleMobileSidebar?.()}
          aria-label={props.mobileSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <Show when={props.mobileSidebarOpen} fallback={<FiMenu class='h-4 w-4' />}>
            <FiX class='h-4 w-4' />
          </Show>
        </button>
        <a
          href={LANDING_URL}
          rel='external'
          class='inline-flex items-center gap-2 text-base font-extrabold tracking-tight drop-shadow sm:text-lg'
        >
          <div class='flex items-center justify-center rounded bg-white p-0.5'>
            <img
              src='/logo.svg'
              alt='CoRATES Logo'
              aria-hidden='true'
              class='h-5 w-5 rounded-sm'
              width='20'
              height='20'
            />
          </div>
          CoRATES
        </a>
        {/* Offline indicator */}
        <Show when={!isOnline()}>
          <div class='flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-1 text-xs text-white'>
            <FiWifiOff class='h-3 w-3' />
            <span class='hidden sm:inline'>Offline</span>
          </div>
        </Show>
      </div>

      <div class='text-2xs flex items-center space-x-4 sm:text-xs'>
        <A
          href='/projects'
          class='flex h-9 items-center rounded px-2 font-medium transition hover:bg-blue-600'
        >
          Projects
        </A>
        <Show
          when={user() || (authLoading() && isLikelyLoggedIn)}
          fallback={
            <>
              <A
                href='/signin'
                class='flex h-9 items-center rounded px-2 font-medium transition hover:bg-blue-600'
              >
                Sign In
              </A>
              <A
                href='/signup'
                class='flex h-9 items-center rounded px-2 font-medium transition hover:bg-blue-600'
              >
                Sign Up
              </A>
            </>
          }
        >
          {/* User dropdown menu */}
          <div class='relative' ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu())}
              class='flex h-9 items-center space-x-2 rounded px-2 font-medium transition hover:bg-blue-600'
            >
              <Avatar
                src={user()?.image}
                name={user()?.name || storedName}
                class='h-6 w-6 overflow-hidden rounded-full'
                fallbackClass='flex items-center justify-center w-full h-full bg-white/20 text-white text-xs font-medium'
              />
              <span class='hidden sm:block'>{user()?.name || storedName || 'Loading...'}</span>
              <FiChevronDown
                class={`h-3 w-3 transition-transform ${showUserMenu() ? 'rotate-180' : ''}`}
                aria-hidden='true'
              />
            </button>

            <Show when={showUserMenu()}>
              <div class='absolute right-0 z-50 mt-2 w-48 rounded-md border border-gray-200 bg-white py-1 text-gray-700 shadow-lg'>
                <div class='border-b border-gray-200 px-4 py-2 text-sm'>
                  <div class='font-medium text-gray-900'>{user()?.name || 'User'}</div>
                  <div class='truncate text-xs text-gray-500'>{user()?.email}</div>
                </div>
                <A
                  href='/profile'
                  class='block px-4 py-2 text-sm hover:bg-gray-100'
                  onClick={() => setShowUserMenu(false)}
                >
                  Profile
                </A>
                <A
                  href='/settings'
                  class='block px-4 py-2 text-sm hover:bg-gray-100'
                  onClick={() => setShowUserMenu(false)}
                >
                  Settings
                </A>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleSignOut();
                  }}
                  class='block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100'
                >
                  Sign Out
                </button>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </nav>
  );
}
