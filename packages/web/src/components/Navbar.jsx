import { Show, createEffect, createSignal, onMount, onCleanup } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { FiMenu, FiWifiOff, FiChevronDown } from 'solid-icons/fi';
import { LANDING_URL } from '@config/api.js';
import useOnlineStatus from '@primitives/useOnlineStatus.js';
import { Avatar } from '@corates/ui';

export default function Navbar(props) {
  const { user, signout, authLoading } = useBetterAuth();
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

  // Close user menu when clicking outside
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
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <nav class='sticky top-0 z-50 flex items-center justify-between bg-linear-to-r from-blue-700 to-blue-500 px-4 py-2 text-white shadow-lg'>
      <div class='flex items-center space-x-3'>
        {/* Sidebar toggle button */}
        <button
          class='-ml-1.5 rounded-full border border-blue-200 bg-white/80 p-1.5 text-blue-700 shadow transition-all duration-200 hover:bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none'
          onClick={() => props.toggleSidebar()}
          aria-label='Toggle sidebar'
        >
          <Show
            when={!props.open}
            fallback={
              <svg fill='currentColor' class='h-4 w-4' viewBox='0 0 20 20'>
                <path d='M3.5 3C3.77614 3 4 3.22386 4 3.5V16.5L3.99023 16.6006C3.94371 16.8286 3.74171 17 3.5 17C3.25829 17 3.05629 16.8286 3.00977 16.6006L3 16.5V3.5C3 3.22386 3.22386 3 3.5 3ZM11.2471 5.06836C11.4476 4.95058 11.7104 4.98547 11.8721 5.16504C12.0338 5.34471 12.0407 5.60979 11.9023 5.79688L11.835 5.87207L7.80371 9.5H16.5C16.7761 9.5 17 9.72386 17 10C17 10.2761 16.7761 10.5 16.5 10.5H7.80371L11.835 14.1279C12.0402 14.3127 12.0568 14.6297 11.8721 14.835C11.6873 15.0402 11.3703 15.0568 11.165 14.8721L6.16504 10.3721L6.09473 10.2939C6.03333 10.2093 6 10.1063 6 10C6 9.85828 6.05972 9.72275 6.16504 9.62793L11.165 5.12793L11.2471 5.06836Z' />
              </svg>
            }
          >
            <FiMenu class='h-4 w-4' />
          </Show>
        </button>
        <a
          href={LANDING_URL}
          rel='external'
          class='text-base font-extrabold tracking-tight drop-shadow sm:text-lg'
        >
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
          href='/dashboard'
          class='flex h-9 items-center rounded px-2 font-medium transition hover:bg-blue-600'
        >
          Dashboard
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
